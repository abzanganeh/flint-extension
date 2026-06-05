import React, { useEffect, useState } from "react";
import type { ExtractedJD } from "../src/types.js";
import { getAccessTokenOrNull, login, logout } from "../src/auth.js";
import { apiSaveJD } from "../src/api.js";

type View = "loading" | "login" | "not_on_job" | "job_ready" | "saving" | "saved" | "error";

const FLINT_NOT_INSTALLED_TIMEOUT_MS = 3000;

export function Popup(): React.ReactElement {
  const [view, setView] = useState<View>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [jd, setJd] = useState<ExtractedJD | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [flintFallback, setFlintFallback] = useState(false);
  const [savedExportToken, setSavedExportToken] = useState<string | null>(null);

  useEffect(() => {
    void _init();
  }, []);

  async function _init(): Promise<void> {
    const token = await getAccessTokenOrNull();
    if (!token) {
      setView("login");
      return;
    }
    await _extractJD();
  }

  async function _extractJD(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setView("not_on_job");
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/jd-extractor.js"],
      });
    } catch {
      // Content script may already be injected; ignore duplicate injection error.
    }

    const response = await new Promise<{ type: string; jd?: ExtractedJD; error?: string }>(
      (resolve) => {
        chrome.tabs.sendMessage(tab.id!, { type: "EXTRACT_JD" }, (msg) => {
          if (chrome.runtime.lastError || !msg) {
            resolve({ type: "JD_ERROR", error: "No response from page" });
          } else {
            resolve(msg);
          }
        });
      },
    );

    if (response.type === "JD_RESULT" && response.jd && response.jd.text.length >= 100) {
      setJd(response.jd);
      setView("job_ready");
    } else {
      setView("not_on_job");
    }
  }

  async function handleLogin(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoginError(null);
    try {
      await login(email, password);
      setView("loading");
      await _extractJD();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    }
  }

  async function handleLogout(): Promise<void> {
    await logout();
    setView("login");
    setJd(null);
  }

  async function handleSaveJD(): Promise<void> {
    if (!jd) return;
    const token = await getAccessTokenOrNull();
    if (!token) {
      setView("login");
      return;
    }

    setView("saving");
    try {
      const result = await apiSaveJD(
        {
          url: jd.url,
          title: jd.title,
          company: jd.company,
          text: jd.text,
          source: "extension",
        },
        token,
      );
      setSavedExportToken(result.export_token);
      setView("saved");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Save failed");
      setView("error");
    }
  }

  function handleOpenInFlint(): void {
    if (!savedExportToken) return;

    const url = `flint://import?token=${savedExportToken}`;

    chrome.tabs.create({ url });

    setFlintFallback(false);
    const timer = setTimeout(() => {
      setFlintFallback(true);
    }, FLINT_NOT_INSTALLED_TIMEOUT_MS);

    window.addEventListener("blur", () => clearTimeout(timer), { once: true });
  }

  if (view === "loading") {
    return (
      <div className="popup">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  if (view === "login") {
    return (
      <div className="popup">
        <header className="popup-header">
          <span className="logo">Flint</span>
        </header>
        <form className="login-form" onSubmit={(e) => void handleLogin(e)}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {loginError && <p className="error-text">{loginError}</p>}
          <button type="submit" className="btn-primary">
            Log in
          </button>
        </form>
      </div>
    );
  }

  if (view === "not_on_job") {
    return (
      <div className="popup">
        <header className="popup-header">
          <span className="logo">Flint</span>
          <button className="btn-ghost" onClick={() => void handleLogout()}>
            Log out
          </button>
        </header>
        <p className="hint">Navigate to a LinkedIn or Greenhouse job posting to capture it.</p>
      </div>
    );
  }

  if (view === "job_ready" && jd) {
    return (
      <div className="popup">
        <header className="popup-header">
          <span className="logo">Flint</span>
          <button className="btn-ghost" onClick={() => void handleLogout()}>
            Log out
          </button>
        </header>
        <div className="jd-preview">
          <p className="jd-title">{jd.title || "Untitled Role"}</p>
          {jd.company && <p className="jd-company">{jd.company}</p>}
          <p className="jd-method">{jd.extraction_method} extraction</p>
        </div>
        <button className="btn-primary" onClick={() => void handleSaveJD()}>
          Save JD
        </button>
      </div>
    );
  }

  if (view === "saving") {
    return (
      <div className="popup">
        <div className="spinner" aria-label="Saving" />
        <p className="hint">Saving job description…</p>
      </div>
    );
  }

  if (view === "saved" && jd) {
    return (
      <div className="popup">
        <header className="popup-header">
          <span className="logo">Flint</span>
        </header>
        <div className="jd-preview">
          <p className="jd-title">{jd.title || "Untitled Role"}</p>
          {jd.company && <p className="jd-company">{jd.company}</p>}
        </div>
        <button className="btn-primary" onClick={handleOpenInFlint}>
          Open in Flint
        </button>
        {flintFallback && (
          <p className="fallback-hint">
            Flint does not appear to be installed.{" "}
            <a
              href="https://flint.app/download"
              target="_blank"
              rel="noreferrer"
            >
              Download Flint
            </a>
          </p>
        )}
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="popup">
        <header className="popup-header">
          <span className="logo">Flint</span>
        </header>
        <p className="error-text">{errorMessage ?? "Something went wrong."}</p>
        <button className="btn-ghost" onClick={() => setView("job_ready")}>
          Try again
        </button>
      </div>
    );
  }

  return <div className="popup" />;
}
