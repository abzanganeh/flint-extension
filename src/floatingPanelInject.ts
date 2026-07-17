/**
 * Handles chrome.action.onClicked for browsers where the toolbar action has
 * no default_popup (Chrome). Expands the in-page floating panel on the
 * active tab, injecting the content script on demand via activeTab when the
 * page did not already match a declared content_scripts host.
 */
import type { ExpandFloatingPanelResult, PopupMessage } from "./types.js";

const FLOATING_SHELL_SCRIPT = "content/floating-shell.js";

const EXPAND_MESSAGE: PopupMessage = { type: "EXPAND_FLOATING_PANEL" };

async function sendExpandMessage(tabId: number): Promise<boolean> {
  try {
    const response = (await chrome.tabs.sendMessage(
      tabId,
      EXPAND_MESSAGE,
    )) as ExpandFloatingPanelResult | undefined;
    return response?.ok === true;
  } catch {
    // No listener registered yet in this tab — the shell has not been
    // injected (declarative content_scripts did not match this URL).
    return false;
  }
}

export async function injectAndExpandFloatingPanel(tabId: number | undefined): Promise<void> {
  if (typeof tabId !== "number") return;

  if (await sendExpandMessage(tabId)) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [FLOATING_SHELL_SCRIPT],
    });
  } catch {
    // Restricted page (chrome://, Web Store, PDF viewer, etc.) — nothing
    // more we can do without additional host permissions.
    return;
  }

  await sendExpandMessage(tabId);
}
