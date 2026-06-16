/** True when the URL is any LinkedIn job surface (view, search, collections, etc.). */
export function isLinkedInJobPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("linkedin.com")) return false;
    return parsed.pathname.includes("/jobs/");
  } catch {
    return false;
  }
}

/**
 * LinkedIn collections/search pages carry the selected job id in query params.
 * Fetch the public view URL for JSON-LD when the live DOM has no JobPosting.
 */
export function resolveLinkedInJobFetchUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("linkedin.com")) return url;

    const jobId =
      parsed.searchParams.get("currentJobId") ?? parsed.searchParams.get("jobId");
    if (jobId && /^\d+$/.test(jobId)) {
      return `https://www.linkedin.com/jobs/view/${jobId}`;
    }

    return url;
  } catch {
    return url;
  }
}
