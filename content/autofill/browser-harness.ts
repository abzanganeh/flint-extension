import { observeApplicationSteps } from "./continuation.js";
import { detectApplicationForm } from "./detector.js";
import { fillGreenhouse } from "./greenhouse.js";
import { AutofillOverlay } from "./overlay.js";

declare global {
  interface Window {
    __flintAutofillTest?: {
      fillGreenhouse: typeof fillGreenhouse;
      detectApplicationForm: typeof detectApplicationForm;
      observeApplicationSteps: typeof observeApplicationSteps;
      mountMultistepProbe: () => {
        getView: () => string;
        getEvents: () => string[];
        destroy: () => void;
      };
    };
  }
}

function mountMultistepProbe(): {
  getView: () => string;
  getEvents: () => string[];
  destroy: () => void;
} {
  const events: string[] = [];
  let overlayView = "hidden";

  const overlay = new AutofillOverlay(
    {
      onAutofillConfirm: () => {
        events.push("autofill-confirmed");
      },
      onSessionPick: () => undefined,
      onDismiss: () => {
        overlayView = "hidden";
      },
    },
    globalThis.location?.href ?? "",
  );

  overlay.mount();

  const initial = detectApplicationForm(document.body, "boards.greenhouse.io");
  if (initial.isApplicationForm) {
    overlay.showOffer({ title: "Probe Role", company: "Probe Co" }, "jd-probe");
    overlayView = overlay.getView();
    events.push("step1-offer");
  }

  const stop = observeApplicationSteps({
    root: document.body,
    hostname: "boards.greenhouse.io",
    debounceMs: 80,
    onStepChange: () => {
      events.push("step-change");
      const detection = detectApplicationForm(document.body, "boards.greenhouse.io");
      if (detection.isApplicationForm) {
        overlay.showOffer({ title: "Probe Role", company: "Probe Co" }, "jd-probe");
        overlayView = overlay.getView();
        events.push("re-offer");
      }
    },
    onApplicationComplete: () => {
      events.push("complete");
      overlay.hide();
      overlayView = overlay.getView();
    },
  });

  return {
    getView: () => overlayView,
    getEvents: () => [...events],
    destroy: () => {
      stop();
      overlay.destroy();
    },
  };
}

window.__flintAutofillTest = {
  fillGreenhouse,
  detectApplicationForm,
  observeApplicationSteps,
  mountMultistepProbe,
};

export {};
