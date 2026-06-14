import { ensureRefreshAlarmRegistered, handleRefreshAlarm } from "../src/auth.js";

// Re-register the refresh alarm on every service worker instantiation
// (install, update, and post-termination wake-up). The MV3 `activate` event
// only fires on install/update — not on every cold start — so registering at
// module top-level guarantees alarm survival across SW restarts even when
// chrome.alarms persistence is dropped after long idle periods.
ensureRefreshAlarmRegistered().catch(() => {
  // Non-fatal: next popup open will detect the expired token.
});

chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  handleRefreshAlarm(alarm.name).catch(() => {
    // Refresh failure is handled inside handleRefreshAlarm (clears auth).
  });
});
