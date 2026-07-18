import type { FieldCandidate } from "./detector.js";
import { fillApplicationForm } from "./fill-engine.js";
import type { AutofillPayload, FillResult } from "./types.js";

/**
 * Greenhouse always resolves against the greenhouse selector map first, regardless
 * of payload.platform, preserving pre-engine-extraction behavior.
 */
export function fillGreenhouse(
  payload: AutofillPayload,
  candidates: FieldCandidate[] = [],
  root: ParentNode = document,
): FillResult {
  return fillApplicationForm(payload, candidates, root, { preferSelectorMap: "greenhouse" });
}
