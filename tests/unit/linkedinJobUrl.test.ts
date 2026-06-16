import { describe, it, expect } from "vitest";
import { isLinkedInJobPage, resolveLinkedInJobFetchUrl } from "../../src/linkedinJobUrl.js";

describe("isLinkedInJobPage", () => {
  it("matches collections URLs", () => {
    expect(
      isLinkedInJobPage(
        "https://www.linkedin.com/jobs/collections/top-applicant/?currentJobId=4385528913",
      ),
    ).toBe(true);
  });

  it("matches classic view URLs", () => {
    expect(isLinkedInJobPage("https://www.linkedin.com/jobs/view/4385528913")).toBe(true);
  });

  it("rejects LinkedIn feed", () => {
    expect(isLinkedInJobPage("https://www.linkedin.com/feed/")).toBe(false);
  });
});

describe("resolveLinkedInJobFetchUrl", () => {
  it("maps currentJobId to jobs/view URL", () => {
    expect(
      resolveLinkedInJobFetchUrl(
        "https://www.linkedin.com/jobs/collections/top-applicant/?currentJobId=4385528913",
      ),
    ).toBe("https://www.linkedin.com/jobs/view/4385528913");
  });

  it("leaves view URLs unchanged", () => {
    const url = "https://www.linkedin.com/jobs/view/4385528913";
    expect(resolveLinkedInJobFetchUrl(url)).toBe(url);
  });
});
