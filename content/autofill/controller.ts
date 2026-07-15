import { observeApplicationSteps } from "./continuation.js";
import { detectApplicationForm, observeApplicationForm } from "./detector.js";
import { fillGreenhouse } from "./greenhouse.js";
import { AutofillOverlay } from "./overlay.js";
import type { AutofillPayload } from "./types.js";
import type { TailoredSessionOption } from "../../src/autofillApi.js";
import { isAutofillEnabled } from "../../src/autofillFlags.js";
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

interface ProbeAutofillMessage {
  type: "PROBE_AUTOFILL";
  jdId?: string;
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
  let filledThisStep = false;
  let autofillEnabled = true;

  void isAutofillEnabled().then((enabled) => {
    autofillEnabled = enabled;
  });

  async function refreshSessions(): Promise<void> {
    recentSessions = await requestRecentSessions();
  }

  async function runAutofill(jdId: string): Promise<void> {
    if (!autofillEnabled) return;

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

    filledThisStep = true;
    overlay.showResult(result);
  }

  function presentMatch(
    match: ReturnType<typeof matchTailoredSession>,
    preferredJdId?: string,
  ): void {
    if (preferredJdId) {
      const preferred = recentSessions.find((session) => session.jd_id === preferredJdId);
      if (preferred) {
        overlay.showOffer(
          { title: preferred.title, company: preferred.company },
          preferred.jd_id,
        );
        return;
      }
    }

    if (match.kind === "single") {
      overlay.showOffer(
        { title: match.session.title, company: match.session.company },
        match.session.jd_id,
      );
      return;
    }

    if (match.kind === "picker") {
      overlay.showPicker(match.sessions);
    }
  }

  function maybeOffer(
    detection = detectApplicationForm(document.body, hostname),
    preferredJdId?: string,
  ): void {
    if (!autofillEnabled) return;
    if (!detection.isApplicationForm || overlay.isDismissedForPage() || offering || filledThisStep) {
      return;
    }
    if (recentSessions.length === 0) return;

    offering = true;
    const match = matchTailoredSession(recentSessions, hostname);
    presentMatch(match, preferredJdId);
    offering = false;
  }

  chrome.runtime.onMessage.addListener((message: ProbeAutofillMessage, _sender, sendResponse) => {
    if (message.type !== "PROBE_AUTOFILL") return false;

    void (async () => {
      autofillEnabled = await isAutofillEnabled();
      if (!autofillEnabled) {
        sendResponse({ ok: false, error: "Autofill disabled" });
        return;
      }

      await refreshSessions();
      const detection = detectApplicationForm(document.body, hostname);
      if (!detection.isApplicationForm) {
        overlay.showMessage(
          "No application form detected",
          "Navigate to the job application form, then try Autofill again.",
        );
        sendResponse({ ok: false, error: "no_form" });
        return;
      }

      filledThisStep = false;
      maybeOffer(detection, message.jdId);
      sendResponse({ ok: true });
    })();

    return true;
  });

  void refreshSessions().then(() => {
    observeApplicationForm(() => {
      maybeOffer();
    }, { hostname });

    observeApplicationSteps({
      hostname,
      onStepChange: () => {
        filledThisStep = false;
        if (!activeJdId) {
          maybeOffer();
          return;
        }
        void runAutofill(activeJdId);
      },
      onApplicationComplete: () => {
        overlay.hide();
        filledThisStep = false;
        activeJdId = null;
      },
    });
  });
}
