import React, { useEffect, useRef, useState } from "react";
import type { ExtractedJD } from "../src/types.js";
import { getAccessTokenOrNull, login, loginWithGoogle, logout } from "../src/auth.js";
import { apiSaveJD } from "../src/api.js";
import { buildTailorInFlintResumeUrl, getGoogleClientId } from "../src/urls.js";

type View = "loading" | "login" | "not_on_job" | "job_ready" | "saving" | "saved" | "error";

const FLINT_NOT_INSTALLED_TIMEOUT_MS = 3000;

// chrome.runtime.getURL resolves correctly inside the extension bundle.
const ICON_URL = typeof chrome !== "undefined" && chrome.runtime?.getURL
  ? chrome.runtime.getURL("icons/icon32.png")
  : "/icons/icon32.png";

export function Popup(): React.ReactElement {
  const [view, setView] = useState<View>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [jd, setJd] = useState<ExtractedJD | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [flintFallback, setFlintFallback] = useState(false);
  const [savedJdId, setSavedJdId] = useState<string | null>(null);
  const [savedExportToken, setSavedExportToken] = useState<string | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void _init();
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
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

  async function handleGoogleLogin(): Promise<void> {
    if (!getGoogleClientId()) {
      setLoginError("Google login is not configured for this build.");
      return;
    }
    setGoogleLoading(true);
    setLoginError(null);
    try {
      await loginWithGoogle();
      setView("loading");
      await _extractJD();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
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
      setSavedJdId(result.jd_id);
      setSavedExportToken(result.export_token);
      setView("saved");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Save failed");
      setView("error");
    }
  }

  function handleTailorInFlintResume(): void {
    if (!savedJdId) return;
    void chrome.tabs.create({ url: buildTailorInFlintResumeUrl(savedJdId) });
  }

  function handlePrepInFlintDesktop(): void {
    if (!savedExportToken) return;

    const url = `flint://import?token=${savedExportToken}`;
    void chrome.tabs.create({ url });

    // Popups close immediately on navigation so window blur never fires.
    // Use a plain timeout: if Flint is installed it handles the deep link
    // within the OS; we show a fallback hint after the window stays open.
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    setFlintFallback(false);
    fallbackTimerRef.current = setTimeout(() => {
      setFlintFallback(true);
    }, FLINT_NOT_INSTALLED_TIMEOUT_MS);
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
          <div className="popup-brand">
            <img src={ICON_URL} alt="" className="popup-icon" width={24} height={24} />
            <span className="logo">Flint Resume</span>
          </div>
        </header>
        <button
          type="button"
          className="btn-google"
          onClick={() => void handleGoogleLogin()}
          disabled={googleLoading}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {googleLoading ? "Connecting…" : "Continue with Google"}
        </button>

        <div className="login-divider">
          <span>or</span>
        </div>

        <form className="login-form" onSubmit={(e) => void handleLogin(e)}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
          <div className="popup-brand">
            <img src={ICON_URL} alt="" className="popup-icon" width={24} height={24} />
            <span className="logo">Flint Resume</span>
          </div>
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
          <div className="popup-brand">
            <img src={ICON_URL} alt="" className="popup-icon" width={24} height={24} />
            <span className="logo">Flint Resume</span>
          </div>
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
          Save job
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
          <div className="popup-brand">
            <img src={ICON_URL} alt="" className="popup-icon" width={24} height={24} />
            <span className="logo">Flint Resume</span>
          </div>
        </header>
        <div className="jd-preview">
          <p className="jd-title">{jd.title || "Untitled Role"}</p>
          {jd.company && <p className="jd-company">{jd.company}</p>}
        </div>
        <button className="btn-primary" onClick={handleTailorInFlintResume}>
          Tailor in Flint Resume
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={handlePrepInFlintDesktop}
        >
          Prep in Flint (desktop)
        </button>
        <p className="hint hint-compact">
          Tailor your resume on the web first. Use desktop for interview prep only.
        </p>
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
          <div className="popup-brand">
            <img src={ICON_URL} alt="" className="popup-icon" width={24} height={24} />
            <span className="logo">Flint Resume</span>
          </div>
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
