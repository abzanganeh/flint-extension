import { getApiBaseUrl } from "./urls.js";

const STORAGE_PREFIX = "sr_metric_beacon:extension_open:";

export function recordExtensionOpenBeacon(): void {
  const day = new Date().toISOString().slice(0, 10);
  const storageKey = `${STORAGE_PREFIX}${day}`;
  try {
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "1");
  } catch {
    // continue
  }

  const base = getApiBaseUrl().replace(/\/$/, "");
  void fetch(`${base}/api/public/metrics/beacon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "extension_open" }),
    keepalive: true,
  }).catch(() => {
    /* best-effort */
  });
}
