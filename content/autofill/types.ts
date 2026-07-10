/** Autofill scaffold types — Phase 4 kickoff (Strategy B §4). */

export interface AutofillFieldPayload {
  selector: string;
  value: string;
  label?: string;
}

export interface AutofillPayload {
  jd_id: string;
  platform: "greenhouse" | "linkedin" | "unknown";
  fields: AutofillFieldPayload[];
}

export interface FillResult {
  fields_attempted: number;
  fields_filled: number;
  fields_failed: string[];
}

export function emptyFillResult(): FillResult {
  return { fields_attempted: 0, fields_filled: 0, fields_failed: [] };
}
