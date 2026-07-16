import selectorsConfig from "./selectors.json";
import type { FieldCandidate } from "./detector.js";
import {
  querySelectorSafe,
  setSelectByVisibleText,
  setTextControlValue,
} from "./fill-utils.js";
import type {
  AutofillPayload,
  FieldFillOutcome,
  FieldFillStatus,
  FillResult,
} from "./types.js";
import { computePercentFilled, previewValue } from "./types.js";

interface SelectorField {
  key: string;
  selector: string;
}

interface SelectorsFile {
  greenhouse: { fields: SelectorField[] };
}

function selectorForKey(key: string): string | null {
  const config = selectorsConfig as SelectorsFile;
  return config.greenhouse.fields.find((f) => f.key === key)?.selector ?? null;
}

function candidateSelectorForKey(candidates: FieldCandidate[], key: string): string | null {
  const conceptMap: Record<string, FieldCandidate["concept"]> = {
    first_name: "name",
    last_name: "name",
    email: "email",
    phone: "phone",
    resume: "resume",
    linkedin_url: "linkedin_url",
    work_authorization: "work_authorization",
  };
  const concept = conceptMap[key];
  if (!concept) return null;
  return candidates.find((c) => c.concept === concept)?.selector ?? null;
}

function resolveElement(
  root: ParentNode,
  key: string,
  payloadSelector: string,
  candidates: FieldCandidate[],
): { el: Element | null; matchSource: "selector_map" | "payload" | "heuristic" } {
  const mapped = selectorForKey(key);
  if (mapped) {
    const el = querySelectorSafe(root, mapped);
    if (el) return { el, matchSource: "selector_map" };
  }

  if (payloadSelector) {
    const el = querySelectorSafe(root, payloadSelector);
    if (el) return { el, matchSource: "payload" };
  }

  const heuristic = candidateSelectorForKey(candidates, key);
  if (heuristic) {
    const el = querySelectorSafe(root, heuristic);
    if (el) return { el, matchSource: "heuristic" };
  }

  return { el: null, matchSource: "heuristic" };
}

function writeFieldValue(el: Element, value: string): boolean {
  if (el instanceof HTMLInputElement && el.type.toLowerCase() === "file") {
    return false;
  }
  if (el instanceof HTMLSelectElement) {
    return setSelectByVisibleText(el, value);
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    setTextControlValue(el, value);
    return true;
  }
  return false;
}

function statusForMatch(
  matchSource: "selector_map" | "payload" | "heuristic",
  isFileInput: boolean,
): FieldFillStatus {
  if (isFileInput) return "not_applicable_file_upload";
  if (matchSource === "selector_map" || matchSource === "payload") {
    return "filled_high_confidence";
  }
  return "filled_needs_review";
}

export function fillGreenhouse(
  payload: AutofillPayload,
  candidates: FieldCandidate[] = [],
  root: ParentNode = document,
): FillResult {
  const fields: FieldFillOutcome[] = [];

  for (const field of payload.fields) {
    const { el, matchSource } = resolveElement(root, field.key, field.selector, candidates);
    if (!el) {
      fields.push({ key: field.key, selector: field.selector || null, status: "not_found" });
      continue;
    }

    const isFile = el instanceof HTMLInputElement && el.type.toLowerCase() === "file";
    if (isFile) {
      fields.push({
        key: field.key,
        selector: selectorForKey(field.key) ?? field.selector,
        status: "not_applicable_file_upload",
      });
      continue;
    }

    const written = writeFieldValue(el, field.value);
    if (!written) {
      fields.push({
        key: field.key,
        selector: selectorForKey(field.key) ?? field.selector,
        status: "not_found",
      });
      continue;
    }

    fields.push({
      key: field.key,
      selector: selectorForKey(field.key) ?? field.selector,
      status: statusForMatch(matchSource, false),
      value_preview: previewValue(field.value),
    });
  }

  return { fields, percent_filled: computePercentFilled(fields) };
}
