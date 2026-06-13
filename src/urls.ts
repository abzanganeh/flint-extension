export function getApiBaseUrl(): string {
  return (
    (typeof import.meta !== "undefined"
      ? (import.meta as Record<string, Record<string, string>>).env
          ?.VITE_API_BASE_URL
      : undefined) ?? "http://localhost:8000"
  );
}

/** Flint Resume web app — tailoring wizard entry point. */
export function getWebAppBaseUrl(): string {
  return (
    (typeof import.meta !== "undefined"
      ? (import.meta as Record<string, Record<string, string>>).env
          ?.VITE_WEB_APP_BASE_URL
      : undefined) ?? "http://localhost:3000"
  );
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
