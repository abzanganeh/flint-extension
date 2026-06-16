/** Turn extension API error bodies into short user-facing messages. */
export function formatApiErrorMessage(body: string, fallback: string): string {
  try {
    const parsed = JSON.parse(body) as {
      detail?: { code?: string; message?: string } | string;
    };
    const detail = parsed.detail;
    if (typeof detail === "object" && detail !== null) {
      if (detail.code === "invalid_redirect_uri") {
        return (
          "Extension OAuth redirect mismatch. Rebuild and reload the extension, " +
          "then ensure Google Console has: http://localhost:3000/auth/extension/google/callback"
        );
      }
      if (detail.code === "oauth_failed" && detail.message?.includes("invalid_client")) {
        return "Google client secret is wrong on the backend. Sync GOOGLE_CLIENT_SECRET in backend/.env with root .env, then restart backend.";
      }
      if (detail.message) return detail.message;
      if (detail.code) return detail.code;
    }
    if (typeof detail === "string") return detail;
  } catch {
    // Not JSON — use raw body if short enough.
    if (body.length > 0 && body.length < 200) return body;
  }
  return fallback;
}
