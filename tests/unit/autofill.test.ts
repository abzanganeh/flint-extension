import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectApplicationForm } from "../../content/autofill/detector.js";
import { fillGreenhouse } from "../../content/autofill/greenhouse.js";
import type { AutofillPayload } from "../../content/autofill/types.js";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/autofill/greenhouse");

function loadFixture(name: string): Document {
  const html = readFileSync(join(FIXTURE_DIR, name), "utf8");
  const doc = document.implementation.createHTMLDocument("fixture");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  doc.body.innerHTML = bodyMatch?.[1] ?? html;
  return doc;
}

const SAMPLE_PAYLOAD: AutofillPayload = {
  jd_id: "jd-1",
  platform: "greenhouse",
  fields: [
    {
      key: "first_name",
      selector: "[name='job_application[first_name]']",
      value: "Alex",
    },
    {
      key: "last_name",
      selector: "[name='job_application[last_name]']",
      value: "Rivera",
    },
    {
      key: "email",
      selector: "[name='job_application[email]']",
      value: "alex@example.com",
    },
    {
      key: "phone",
      selector: "[name='job_application[phone]']",
      value: "555-0100",
    },
    {
      key: "resume",
      selector: "[name='job_application[resume]']",
      value: "/tmp/resume.pdf",
    },
    {
      key: "linkedin_url",
      selector: "[name='job_application[urls][LinkedIn]']",
      value: "https://www.linkedin.com/in/alex",
    },
    {
      key: "work_authorization",
      selector: "[name='job_application[answers][work_authorization]']",
      value: "Yes",
    },
  ],
};

describe("fillGreenhouse", () => {
  it("fills text and select fields with high confidence on the fixture form", () => {
    const doc = loadFixture("apply-form.html");
    const detection = detectApplicationForm(doc.body, "boards.greenhouse.io");
    const result = fillGreenhouse(SAMPLE_PAYLOAD, detection.fieldCandidates, doc.body);

    expect(result.percent_filled).toBeGreaterThanOrEqual(85);

    const byKey = Object.fromEntries(result.fields.map((f) => [f.key, f]));
    expect(byKey.first_name?.status).toBe("filled_high_confidence");
    expect(byKey.email?.status).toBe("filled_high_confidence");
    expect(byKey.resume?.status).toBe("not_applicable_file_upload");
    expect(byKey.work_authorization?.status).toBe("filled_high_confidence");

    expect((doc.querySelector("[name='job_application[email]']") as HTMLInputElement).value).toBe(
      "alex@example.com",
    );
    expect(
      (doc.querySelector("[name='job_application[answers][work_authorization]']") as HTMLSelectElement)
        .value,
    ).toBe("yes");
  });

  it("linkedin stub returns empty result", async () => {
    const { fillLinkedIn } = await import("../../content/autofill/linkedin.js");
    const result = fillLinkedIn({ jd_id: "jd-2", platform: "linkedin", fields: [] });
    expect(result.fields).toHaveLength(0);
    expect(result.percent_filled).toBe(0);
  });
});
