import { fillGreenhouse } from "./greenhouse.js";

declare global {
  interface Window {
    __flintAutofillTest?: {
      fillGreenhouse: typeof fillGreenhouse;
    };
  }
}

window.__flintAutofillTest = { fillGreenhouse };

export {};
