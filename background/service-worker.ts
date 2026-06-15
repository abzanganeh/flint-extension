import {
  ensureRefreshAlarmRegistered,
  handleRefreshAlarm,
  loginWithGoogle,
} from "../src/auth.js";
import { extractJobPostingFromHtml } from "../src/jdParse.js";
import type { GoogleLoginResult, ParseJdFromUrlResult, PopupMessage } from "../src/types.js";

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

chrome.runtime.onMessage.addListener(
  (message: PopupMessage, _sender, sendResponse) => {
    if (message.type === "PARSE_JD_FROM_URL") {
      fetch(message.url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      })
        .then((response) => {
          if (!response.ok) {
            sendResponse({ error: `HTTP ${response.status}` } satisfies ParseJdFromUrlResult);
            return;
          }
          return response.text().then((html) => {
            const jd = extractJobPostingFromHtml(html);
            if (jd && jd.text.trim().length >= 200) {
              sendResponse({ jd } satisfies ParseJdFromUrlResult);
            } else {
              sendResponse({ error: "No JobPosting JSON-LD found" } satisfies ParseJdFromUrlResult);
            }
          });
        })
        .catch((err: unknown) => {
          const error = err instanceof Error ? err.message : "Fetch failed";
          sendResponse({ error } satisfies ParseJdFromUrlResult);
        });
      return true;
    }

    if (message.type === "FETCH_PAGE_HTML") {
      fetch(message.url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      })
        .then((response) => {
          if (!response.ok) {
            sendResponse({ error: `HTTP ${response.status}` });
            return;
          }
          return response.text().then((html) => sendResponse({ html }));
        })
        .catch((err: unknown) => {
          const error = err instanceof Error ? err.message : "Fetch failed";
          sendResponse({ error });
        });
      return true;
    }

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

    return true;
  },
);
