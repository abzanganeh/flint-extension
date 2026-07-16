export const AUTOFILL_KILL_SWITCH_KEY = "flint_autofill_disabled";

export async function isAutofillEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(AUTOFILL_KILL_SWITCH_KEY);
  return result[AUTOFILL_KILL_SWITCH_KEY] !== true;
}

export function isGreenhouseHost(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "greenhouse.io" || host.endsWith(".greenhouse.io");
  } catch {
    return false;
  }
}

export function isLinkedInHost(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "linkedin.com" || host.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}
