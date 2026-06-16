/** Delay before closing the transient handoff tab after OS protocol dispatch. */
export const FLINT_DEEP_LINK_TAB_CLOSE_MS = 1600;

export const FLINT_DOWNLOAD_URL = "https://github.com/abzanganeh/flint";

/** Build the opaque Smart Resume → Flint import URL (token only, no JD in URL). */
export function buildFlintImportDeepLink(exportToken: string): string {
  return `flint://import?token=${encodeURIComponent(exportToken)}`;
}

/**
 * Extension handoff page — navigates to `flint://` from an extension origin.
 * Opening `flint://` directly from a service worker tab often fails on
 * Firefox/Linux because the user-gesture chain is lost.
 */
export function buildFlintHandoffTabUrl(exportToken: string): string {
  const deepLink = buildFlintImportDeepLink(exportToken);
  return `${chrome.runtime.getURL("handoff/index.html")}?target=${encodeURIComponent(deepLink)}`;
}

/**
 * Open the handoff tab. Call synchronously from a popup click handler.
 * Uses an active tab so Chrome/Firefox show an external-protocol prompt when required.
 */
export async function openFlintDeepLinkFromPopup(exportToken: string): Promise<void> {
  await chrome.tabs.create({
    url: buildFlintHandoffTabUrl(exportToken),
    active: true,
  });
}

/**
 * Dispatch `flint://` from the popup document while the click user-gesture is active.
 * Works on Chrome and Firefox when OS scheme handlers are registered (Linux: xdg-mime).
 */
export function dispatchFlintDeepLinkFromPopup(exportToken: string): void {
  const deepLink = buildFlintImportDeepLink(exportToken);
  const anchor = document.createElement("a");
  anchor.href = deepLink;
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * @deprecated Prefer {@link openFlintDeepLinkFromPopup} from the popup click handler.
 * Service-worker launch loses the user-gesture chain on Firefox/Linux.
 */
export async function openFlintDeepLink(url: string): Promise<void> {
  const tab = await chrome.tabs.create({ url, active: false });
  if (tab.id === undefined) return;

  const tabId = tab.id;
  setTimeout(() => {
    void chrome.tabs.remove(tabId).catch(() => {
      // Tab may already be gone after the OS intercepts the custom scheme.
    });
  }, FLINT_DEEP_LINK_TAB_CLOSE_MS);
}
