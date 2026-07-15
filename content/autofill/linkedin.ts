import type { AutofillPayload, FillResult } from "./types.js";
import { emptyFillResult } from "./types.js";

/** LinkedIn fill remains scaffold until slice 12 user gate + slice 13 implementation. */
export function fillLinkedIn(_payload: AutofillPayload): FillResult {
  return emptyFillResult();
}
