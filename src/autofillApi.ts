import type { AutofillPayload } from "../content/autofill/types.js";
import { getApiBaseUrl } from "./urls.js";

const API_BASE = getApiBaseUrl();

export interface TailoredSessionOption {
  jd_id: string;
  title: string;
  company: string;
  url_host: string;
  tailored_at: string;
}

export type AutofillPayloadFetchResult =
  | { ok: true; payload: AutofillPayload }
  | { ok: false; code: "not_authenticated" | "not_found" | "not_tailored" | "network" | "unknown" };

async function authedFetch(path: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAutofillPayload(
  jdId: string,
  accessToken: string,
): Promise<AutofillPayloadFetchResult> {
  try {
    const response = await authedFetch(`/api/job-descriptions/${jdId}/autofill-payload`, accessToken);
    if (response.status === 404) return { ok: false, code: "not_found" };
    if (response.status === 409) return { ok: false, code: "not_tailored" };
    if (!response.ok) return { ok: false, code: "unknown" };
    return { ok: true, payload: (await response.json()) as AutofillPayload };
  } catch {
    return { ok: false, code: "network" };
  }
}

export async function fetchRecentTailoredSessions(
  accessToken: string,
): Promise<TailoredSessionOption[]> {
  try {
    const response = await authedFetch("/api/job-descriptions/recent-tailored", accessToken);
    if (!response.ok) return [];
    const body = (await response.json()) as { sessions?: TailoredSessionOption[] };
    return body.sessions ?? [];
  } catch {
    return [];
  }
}
