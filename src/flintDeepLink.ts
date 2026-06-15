/** Delay before closing the transient flint:// tab after OS protocol handoff. */
export const FLINT_DEEP_LINK_TAB_CLOSE_MS = 1200;

/**
 * Open a flint:// deep link in a background tab and close it shortly after.
 * Must run in the service worker — popup timers are destroyed when the popup closes.
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
