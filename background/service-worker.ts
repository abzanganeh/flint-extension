import {
  ensureRefreshAlarmRegistered,
  handleRefreshAlarm,
  loginWithGoogle,
} from "../src/auth.js";
import type { GoogleLoginResult, PopupMessage } from "../src/types.js";

// Re-register the refresh alarm on SW startup so token rotation survives
// service worker restarts (MV3 lifecycle requirement).
self.addEventListener("activate", () => {
  ensureRefreshAlarmRegistered().catch(() => {
    // Non-fatal: next popup open will detect the expired token.
  });
});

chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  handleRefreshAlarm(alarm.name).catch(() => {
    // Refresh failure is handled inside handleRefreshAlarm (clears auth).
  });
});

// Handle Google OAuth from the popup. Running the flow here instead of in the
// popup means the flow survives the popup closing (which happens the moment
// the user focuses the Google account picker window).
chrome.runtime.onMessage.addListener(
  (message: PopupMessage, _sender, sendResponse) => {
    if (message.type !== "GOOGLE_LOGIN") return false;

    loginWithGoogle()
      .then((user): void => {
        const result: GoogleLoginResult = { success: true, user };
        sendResponse(result);
      })
      .catch((err: unknown): void => {
        const error = err instanceof Error ? err.message : "Google sign-in failed";
        const result: GoogleLoginResult = { success: false, error };
        sendResponse(result);
      });

    // Return true to keep the message channel open for the async response.
    return true;
  },
);
