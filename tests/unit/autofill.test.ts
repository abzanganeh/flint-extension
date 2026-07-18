import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectApplicationForm } from "../../content/autofill/detector.js";
import { fillApplicationForm } from "../../content/autofill/fill-engine.js";
import { fillGreenhouse } from "../../content/autofill/greenhouse.js";
import type { AutofillPayload } from "../../content/autofill/types.js";

const FIXTURES_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/autofill");
const FIXTURE_DIR = join(FIXTURES_ROOT, "greenhouse");

function loadFixture(name: string, fixtureDir = FIXTURE_DIR): Document {
  const html = readFileSync(join(fixtureDir, name), "utf8");
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

describe("fillApplicationForm (shared engine)", () => {
  it("matches fillGreenhouse's fill rate when forced onto the greenhouse selector map", () => {
    const doc = loadFixture("apply-form.html");
    const detection = detectApplicationForm(doc.body, "boards.greenhouse.io");
    const result = fillApplicationForm(SAMPLE_PAYLOAD, detection.fieldCandidates, doc.body, {
      preferSelectorMap: "greenhouse",
    });

    expect(result.percent_filled).toBeGreaterThanOrEqual(85);
    const byKey = Object.fromEntries(result.fields.map((f) => [f.key, f]));
    expect(byKey.first_name?.status).toBe("filled_high_confidence");
    expect(byKey.resume?.status).toBe("not_applicable_file_upload");
  });

  it("fills a generic unknown-platform form via detector heuristics with needs_review statuses", () => {
    const doc = loadFixture("apply-form.html", join(FIXTURES_ROOT, "generic"));
    const detection = detectApplicationForm(doc.body, "careers.acme.example");
    expect(detection.platform).toBe("unknown");
    expect(detection.isApplicationForm).toBe(true);

    const payload: AutofillPayload = {
      jd_id: "jd-generic",
      platform: "unknown",
      fields: [
        { key: "email", selector: "", value: "sam@example.com" },
        { key: "phone", selector: "", value: "555-0111" },
        { key: "linkedin_url", selector: "", value: "https://www.linkedin.com/in/sam" },
        { key: "work_authorization", selector: "", value: "Yes" },
        { key: "resume", selector: "", value: "/tmp/resume.pdf" },
      ],
    };

    const result = fillApplicationForm(payload, detection.fieldCandidates, doc.body);
    const byKey = Object.fromEntries(result.fields.map((f) => [f.key, f]));

    expect(byKey.email?.status).toBe("filled_needs_review");
    expect(byKey.phone?.status).toBe("filled_needs_review");
    expect(byKey.linkedin_url?.status).toBe("filled_needs_review");
    expect(byKey.work_authorization?.status).toBe("filled_needs_review");
    expect(byKey.resume?.status).toBe("not_applicable_file_upload");

    expect((doc.querySelector("#candidate-email") as HTMLInputElement).value).toBe("sam@example.com");
    expect((doc.querySelector("#candidate-phone") as HTMLInputElement).value).toBe("555-0111");
  });

  it("never writes into file inputs even when a payload selector targets one directly", () => {
    const doc = loadFixture("apply-form.html", join(FIXTURES_ROOT, "generic"));
    const payload: AutofillPayload = {
      jd_id: "jd-generic-2",
      platform: "unknown",
      fields: [{ key: "resume", selector: "#candidate-resume", value: "/tmp/resume.pdf" }],
    };

    const result = fillApplicationForm(payload, [], doc.body);
    expect(result.fields[0]?.status).toBe("not_applicable_file_upload");
    expect((doc.querySelector("#candidate-resume") as HTMLInputElement).value).toBe("");
  });
});
