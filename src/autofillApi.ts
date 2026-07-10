import type { AutofillPayload } from "../content/autofill/types.js";
import { getApiBaseUrl } from "./urls.js";

const API_BASE = getApiBaseUrl();

export async function fetchAutofillPayload(
  jdId: string,
  accessToken: string,
): Promise<AutofillPayload | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${API_BASE}/api/job-descriptions/${jdId}/autofill-payload`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as AutofillPayload;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
