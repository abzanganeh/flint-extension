// Direct import.meta.env access is required so Vite's static-analysis
// substitution can replace these at build time. Indirect access via a cast
// or object spread bypasses the substitution and always resolves to "".
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
}

export function getWebAppBaseUrl(): string {
  return import.meta.env.VITE_WEB_APP_BASE_URL ?? "http://localhost:3000";
}

export function getGoogleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
}

export function buildTailorInFlintResumeUrl(jdId: string): string {
  const base = getWebAppBaseUrl().replace(/\/$/, "");
  const params = new URLSearchParams({
    jd_id: jdId,
    source: "extension",
    step: "jd",
  });
  return `${base}/session/new?${params.toString()}`;
}

/**
 * Build the Google OAuth authorization URL for use with
 * ``chrome.identity.launchWebAuthFlow``.
 *
 * The ``redirectUri`` must match one of the URIs registered in Google Cloud
 * Console. For Chrome extensions this is the value returned by
 * ``chrome.identity.getRedirectURL()``, e.g.
 * ``https://<ext-id>.chromiumapp.org/``.
 */
export function buildGoogleAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
