import { describe, expect, it } from "vitest";
import { isGreenhouseHost, isLinkedInHost } from "../../src/autofillFlags.js";

describe("autofillFlags", () => {
  it("detects Greenhouse hosts", () => {
    expect(isGreenhouseHost("https://boards.greenhouse.io/acme/jobs/123")).toBe(true);
    expect(isGreenhouseHost("https://example.com/jobs/1")).toBe(false);
  });

  it("detects LinkedIn hosts", () => {
    expect(isLinkedInHost("https://www.linkedin.com/jobs/view/123")).toBe(true);
    expect(isLinkedInHost("https://boards.greenhouse.io/acme/jobs/123")).toBe(false);
  });
});
