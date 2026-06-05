import { ensureRefreshAlarmRegistered, handleRefreshAlarm } from "../src/auth.js";

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
