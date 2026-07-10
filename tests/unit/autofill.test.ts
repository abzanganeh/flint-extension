import { describe, expect, it } from "vitest";
import { fillGreenhouse } from "../../content/autofill/greenhouse.js";
import { fillLinkedIn } from "../../content/autofill/linkedin.js";
import { emptyFillResult } from "../../content/autofill/types.js";

describe("autofill scaffold", () => {
  it("greenhouse stub returns empty result", () => {
    const result = fillGreenhouse({
      jd_id: "jd-1",
      platform: "greenhouse",
      fields: [],
    });
    expect(result).toEqual(emptyFillResult());
  });

  it("linkedin stub returns empty result", () => {
    const result = fillLinkedIn({
      jd_id: "jd-2",
      platform: "linkedin",
      fields: [{ selector: "#name", value: "Jane" }],
    });
    expect(result.fields_attempted).toBe(0);
    expect(result.fields_filled).toBe(0);
  });
});
