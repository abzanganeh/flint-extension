import { describe, it, expect } from "vitest";
import { buildTailorInFlintResumeUrl } from "../../src/urls.js";

describe("buildTailorInFlintResumeUrl", () => {
  it("opens Flint Resume wizard with extension jd_id", () => {
    const url = buildTailorInFlintResumeUrl("e689d8ad-382f-42c6-a8eb-da3da4964c2c");
    expect(url).toBe(
      "http://localhost:3000/session/new?jd_id=e689d8ad-382f-42c6-a8eb-da3da4964c2c&source=extension&step=jd",
    );
  });

  it("adds jd_review when capture may be incomplete", () => {
    const url = buildTailorInFlintResumeUrl("abc", { reviewRecommended: true });
    expect(url).toContain("jd_review=1");
  });
});
