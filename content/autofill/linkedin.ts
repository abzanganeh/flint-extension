import type { AutofillPayload, FillResult } from "./types.js";
import { emptyFillResult } from "./types.js";

/** Scaffold — no DOM mutation until selectors are validated. */
export function fillLinkedIn(_payload: AutofillPayload): FillResult {
  return emptyFillResult();
}
