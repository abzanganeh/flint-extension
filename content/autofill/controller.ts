import { observeApplicationSteps } from "./continuation.js";
import { detectApplicationForm, observeApplicationForm } from "./detector.js";
import { fillGreenhouse } from "./greenhouse.js";
import { AutofillOverlay } from "./overlay.js";
import type { AutofillPayload } from "./types.js";
import type { TailoredSessionOption } from "../../src/autofillApi.js";
import { pickSessionMatch as matchTailoredSession } from "../../src/sessionMatcher.js";

interface RecentSessionsResponse {
  sessions?: TailoredSessionOption[];
  error?: string;
}

interface AutofillPayloadResponse {
  payload?: AutofillPayload;
  error?: string;
  code?: string;
}

function requestRecentSessions(): Promise<TailoredSessionOption[]> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "FETCH_RECENT_TAILORED_SESSIONS" }, (res: RecentSessionsResponse | undefined) => {
      if (chrome.runtime.lastError || !res || res.error) {
        resolve([]);
        return;
      }
      resolve(res.sessions ?? []);
    });
  });
}

function requestAutofillPayload(jdId: string): Promise<AutofillPayloadResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "FETCH_AUTOFILL_PAYLOAD", jdId }, (res: AutofillPayloadResponse | undefined) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message ?? "Extension unavailable" });
        return;
      }
      resolve(res ?? { error: "No response" });
    });
  });
}

export function startAutofillController(): void {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) return;

  const hostname = window.location.hostname;
  const overlay = new AutofillOverlay({
    onAutofillConfirm: (jdId) => {
      void runAutofill(jdId);
    },
    onSessionPick: (jdId) => {
      void runAutofill(jdId);
    },
    onDismiss: () => undefined,
  });

  overlay.mount();

  let recentSessions: TailoredSessionOption[] = [];
  let activeJdId: string | null = null;
  let offering = false;

  async function refreshSessions(): Promise<void> {
    recentSessions = await requestRecentSessions();
  }

  async function runAutofill(jdId: string): Promise<void> {
    activeJdId = jdId;
    const response = await requestAutofillPayload(jdId);
    if (response.code === "not_tailored") {
      overlay.showMessage(
        "Resume not tailored yet",
        "Open this job in Flint Resume, tailor your resume, then return to the application form.",
      );
      return;
    }
    if (!response.payload) {
      return;
    }

    const detection = detectApplicationForm(document.body, hostname);
    const result =
      response.payload.platform === "greenhouse"
        ? fillGreenhouse(response.payload, detection.fieldCandidates, document.body)
        : { fields: [], percent_filled: 0 };

    overlay.showResult(result);
  }

  function maybeOffer(detection = detectApplicationForm(document.body, hostname)): void {
    if (!detection.isApplicationForm || overlay.isDismissedForPage() || offering) return;
    if (recentSessions.length === 0) return;

    offering = true;
    const match = matchTailoredSession(recentSessions, hostname);
    if (match.kind === "none") {
      offering = false;
      return;
    }
    if (match.kind === "single") {
      overlay.showOffer(
        { title: match.session.title, company: match.session.company },
        match.session.jd_id,
      );
    } else {
      overlay.showPicker(match.sessions);
    }
    offering = false;
  }

  void refreshSessions().then(() => {
    observeApplicationForm(() => {
      maybeOffer();
    }, { hostname });

    observeApplicationSteps({
      hostname,
      onStepChange: () => {
        if (!activeJdId) {
          maybeOffer();
          return;
        }
        void runAutofill(activeJdId);
      },
      onApplicationComplete: () => {
        overlay.hide();
      },
    });
  });
}
