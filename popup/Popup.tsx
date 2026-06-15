import React, { useEffect, useRef, useState } from "react";
import type { ExtractedJD, GoogleLoginResult, ParseJdFromUrlResult } from "../src/types.js";
import { getAccessTokenOrNull, login, logout } from "../src/auth.js";
import { apiSaveJD } from "../src/api.js";
import { buildTailorInFlintResumeUrl, getGoogleClientId } from "../src/urls.js";
import { isUncertainJdSource } from "../src/jdCompleteness.js";
import { pickBetterJd, scoreJdText, finalizeJdText, extractJobPostingFromHtml, truncateJdText } from "../src/jdParse.js";

const GOOGLE_ENABLED = Boolean(getGoogleClientId());

// MV3 service workers sleep between events. When the popup sends the first
// message, there is a race window where Chrome has woken the SW but it has
// not yet registered its onMessage listener. Retry with back-off until the
// channel is open or we give up.
async function _sendGoogleLoginToSW(
  maxAttempts = 6,
  baseDelayMs = 200,
): Promise<GoogleLoginResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await new Promise<GoogleLoginResult>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "GOOGLE_LOGIN" },
          (res: GoogleLoginResult | undefined) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (res) {
              resolve(res);
            }
            // res undefined → popup closed mid-flow; SW still stores the token.
          },
        );
      });
      return result;
    } catch (err) {
      const isConnectionError =
        err instanceof Error &&
        (err.message.includes("does not exist") || err.message.includes("establish connection"));

      if (isConnectionError && attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Service worker unreachable — please try again.");
}

const FETCH_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

/** Fetch page HTML from the popup (extension context — no sleeping service worker). */
async function _parseJdFromUrlDirect(
  url: string,
): Promise<{ title: string; company: string; text: string } | null> {
  try {
    const response = await fetch(url, { headers: FETCH_HEADERS });
    if (!response.ok) return null;
    const html = await response.text();
    const parsed = extractJobPostingFromHtml(html);
    if (parsed && parsed.text.trim().length >= 200) return parsed;
  } catch {
    // Network or parse failure — caller tries other paths.
  }
  return null;
}

async function _parseJdFromUrlViaServiceWorker(
  url: string,
  maxAttempts = 6,
  baseDelayMs = 150,
): Promise<{ title: string; company: string; text: string } | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await new Promise<ParseJdFromUrlResult>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "PARSE_JD_FROM_URL", url },
          (res: ParseJdFromUrlResult | undefined) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (res) {
              resolve(res);
            } else {
              reject(new Error("No response from service worker"));
            }
          },
        );
      });
      if ("jd" in result && result.jd && result.jd.text.trim().length >= 200) {
        return result.jd;
      }
    } catch (err) {
      const isConnectionError =
        err instanceof Error &&
        (err.message.includes("does not exist") ||
          err.message.includes("establish connection") ||
          err.message.includes("No response"));
      if (isConnectionError && attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
        continue;
      }
    }
  }
  return null;
}

async function _extractJdFromTab(tabId: number): Promise<ExtractedJD | null> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/jd-extractor.js"],
    });
  } catch {
    // Already injected, or page blocks scripting — SW JSON-LD may still work.
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await new Promise<{ type: string; jd?: ExtractedJD; error?: string }>(
      (resolve) => {
        chrome.tabs.sendMessage(tabId, { type: "EXTRACT_JD" }, (msg) => {
          if (chrome.runtime.lastError || !msg) {
            resolve({ type: "JD_ERROR", error: chrome.runtime.lastError?.message ?? "No response" });
          } else {
            resolve(msg);
          }
        });
      },
    );

    if (response.type === "JD_RESULT" && response.jd && response.jd.text.length >= 200) {
      return response.jd;
    }

    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
    }
  }
  return null;
}

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
    if (!tab?.id || !tab.url || !tab.url.startsWith("http")) {
      setView("not_on_job");
      return;
    }

    // Popup fetch is most reliable on SPAs (Jobright): runs in extension context,
    // no service-worker wake race. SW + content script are fallbacks.
    const [directParsed, swParsed, pageJd] = await Promise.all([
      _parseJdFromUrlDirect(tab.url),
      _parseJdFromUrlViaServiceWorker(tab.url),
      _extractJdFromTab(tab.id),
    ]);

    const structuredParsed = directParsed ?? swParsed;

    const swAsExtracted: ExtractedJD | null = structuredParsed
      ? {
          title: structuredParsed.title || tab.title || "Untitled Role",
          company: structuredParsed.company,
          text: structuredParsed.text,
          url: tab.url,
          extraction_method: "structured",
        }
      : null;

    const bestParsed = pickBetterJd(
      swAsExtracted
        ? { title: swAsExtracted.title, company: swAsExtracted.company, text: swAsExtracted.text }
        : null,
      pageJd
        ? { title: pageJd.title, company: pageJd.company, text: pageJd.text }
        : null,
    );

    if (
      bestParsed &&
      bestParsed.text.trim().length >= 200 &&
      (structuredParsed || scoreJdText(finalizeJdText(bestParsed.text)) >= 0)
    ) {
      const structuredWinner =
        structuredParsed !== null &&
        bestParsed.text === structuredParsed.text &&
        bestParsed.title === structuredParsed.title;
      const finalText = structuredWinner
        ? truncateJdText(bestParsed.text)
        : finalizeJdText(bestParsed.text);
      setJd({
        title: bestParsed.title || tab.title || "Untitled Role",
        company: bestParsed.company,
        text: finalText,
        url: tab.url,
        extraction_method: structuredParsed ? "structured" : (pageJd?.extraction_method ?? "heuristic"),
      });
      setView("job_ready");
    } else {
      setView("not_on_job");
    }
  }

  async function handleGoogleLogin(): Promise<void> {
    setGoogleLoading(true);
    setLoginError(null);

    // Delegate to the service worker. The popup closes the moment the user
    // focuses the Google account picker, so any async work here would be
    // abandoned. The SW survives popup close and stores the token; if the
    // popup is still open when the flow finishes, the SW sends back a result.
    try {
      const result = await _sendGoogleLoginToSW();
      if (result.success) {
        setView("loading");
        await _extractJD();
      } else {
        setLoginError(result.error);
      }
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
    if (!savedJdId || !jd) return;
    void chrome.tabs.create({
      url: buildTailorInFlintResumeUrl(savedJdId, {
        reviewRecommended: isUncertainJdSource(jd.url, jd.extraction_method),
      }),
    });
  }

  function handlePrepInFlintDesktop(): void {
    if (!savedExportToken) return;

    const url = `flint://import?token=${savedExportToken}`;
    // Run in the service worker so tab cleanup survives popup close.
    void chrome.runtime.sendMessage({ type: "OPEN_FLINT_DEEP_LINK", url });

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
        {GOOGLE_ENABLED && (
          <>
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
              {googleLoading ? "Complete sign-in, then reopen…" : "Continue with Google"}
            </button>
            <div className="login-divider"><span>or</span></div>
          </>
        )}

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
        <p className="hint">
          Open a job posting page (LinkedIn, Greenhouse, Jobright, etc.) and try again.
        </p>
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
