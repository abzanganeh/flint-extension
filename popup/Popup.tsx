import React, { useEffect, useState } from "react";
import type { ExtractedJD } from "../src/types.js";
import { getAccessTokenOrNull, login, logout } from "../src/auth.js";
import { apiSaveJD } from "../src/api.js";

type View = "loading" | "login" | "not_on_job" | "job_ready" | "saving" | "saved" | "error";

const FLINT_NOT_INSTALLED_TIMEOUT_MS = 3000;
const RESTRICTED_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:",
  "moz-extension://",
  "view-source:",
  "data:",
  "file://",
];

function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  return RESTRICTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export function Popup(): React.ReactElement {
  const [view, setView] = useState<View>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [jd, setJd] = useState<ExtractedJD | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notOnJobMessage, setNotOnJobMessage] = useState<string | null>(null);
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
      setNotOnJobMessage(null);
      setView("not_on_job");
      return;
    }

    if (isRestrictedUrl(tab.url)) {
      setNotOnJobMessage(
        "Cannot access this page. Open a LinkedIn or Greenhouse job listing.",
      );
      setView("not_on_job");
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/jd-extractor.js"],
      });
    } catch (err) {
      // Two kinds of failure here:
      // 1. The content script is already injected — chrome.scripting raises a
      //    benign error we can ignore and proceed to sendMessage.
      // 2. The tab is on a host the manifest does not allow (e.g. extension
      //    pages slipped past the URL prefix check, restricted store pages).
      //    In that case sendMessage will time out; fall through to "no
      //    response" handling.
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Cannot access")) {
        setNotOnJobMessage(
          "Cannot access this page. Open a LinkedIn or Greenhouse job listing.",
        );
        setView("not_on_job");
        return;
      }
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
      setNotOnJobMessage(null);
      setView("job_ready");
    } else {
      setNotOnJobMessage(null);
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
    // Closure correctness: this handler captures savedExportToken from the
    // current render. The "Open in Flint" button only renders when
    // view === "saved", which only happens after handleSaveJD has called
    // setSavedExportToken and React has re-rendered. So the closure here
    // always sees the freshly stored token, never the initial null.
    if (!savedExportToken) return;

    const url = `flint://import?token=${savedExportToken}`;

    chrome.tabs.create({ url });

    // Heuristic fallback: if the OS does not switch focus away from the
    // popup within 3s, assume Flint is not installed and surface the
    // download link. Known limitation: blur also fires when the user clicks
    // the address bar or another window, producing a false negative (no
    // fallback shown even though Flint did not handle the URL). Documented
    // in store/LISTING.md "Known limitations (Phase 2)".
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
        <p className="hint">
          {notOnJobMessage ??
            "Navigate to a LinkedIn or Greenhouse job posting to capture it."}
        </p>
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
