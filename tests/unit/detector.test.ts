import { describe, expect, it } from "vitest";
import {
  APPLICATION_FORM_CONFIDENCE_THRESHOLD,
  detectApplicationForm,
  detectPlatformFromHost,
} from "../../content/autofill/detector.js";

function loadHtml(html: string): Document {
  const doc = document.implementation.createHTMLDocument("fixture");
  doc.body.innerHTML = html;
  return doc;
}

const GREENHOUSE_FORM = `
<form id="application_form">
  <input name="job_application[first_name]" id="first_name" placeholder="First Name" />
  <input name="job_application[last_name]" id="last_name" placeholder="Last Name" />
  <input name="job_application[email]" id="email" type="email" placeholder="Email" />
  <input name="job_application[phone]" id="phone" type="tel" placeholder="Phone" />
  <input name="job_application[resume]" id="resume" type="file" aria-label="Resume/CV" />
</form>
`;

const NEWS_ARTICLE = `
<article>
  <h1>Markets rally on jobs report</h1>
  <p>Stocks climbed after the latest employment data beat expectations.</p>
</article>
`;

const CONTACT_FORM = `
<form id="contact">
  <label for="contact_name">Name</label>
  <input id="contact_name" name="name" />
  <label for="contact_email">Email</label>
  <input id="contact_email" name="email" type="email" />
  <label for="contact_message">Message</label>
  <textarea id="contact_message" name="message"></textarea>
</form>
`;

describe("detectPlatformFromHost", () => {
  it("detects Greenhouse hosts", () => {
    expect(detectPlatformFromHost("boards.greenhouse.io")).toBe("greenhouse");
    expect(detectPlatformFromHost("acme.greenhouse.io")).toBe("greenhouse");
  });

  it("detects LinkedIn hosts", () => {
    expect(detectPlatformFromHost("www.linkedin.com")).toBe("linkedin");
  });

  it("returns unknown for unrelated hosts", () => {
    expect(detectPlatformFromHost("example.com")).toBe("unknown");
  });
});

describe("detectApplicationForm", () => {
  it("detects a Greenhouse-shaped application form above the offer threshold", () => {
    const doc = loadHtml(GREENHOUSE_FORM);
    const result = detectApplicationForm(doc.body, "boards.greenhouse.io");

    expect(result.platform).toBe("greenhouse");
    expect(result.confidence).toBeGreaterThanOrEqual(APPLICATION_FORM_CONFIDENCE_THRESHOLD);
    expect(result.isApplicationForm).toBe(true);
    expect(result.fieldCandidates.map((c) => c.concept)).toEqual(
      expect.arrayContaining(["name", "email", "phone", "resume"]),
    );
  });

  it("does not flag a news article as an application form", () => {
    const doc = loadHtml(NEWS_ARTICLE);
    const result = detectApplicationForm(doc.body, "example.com");

    expect(result.isApplicationForm).toBe(false);
    expect(result.confidence).toBeLessThan(APPLICATION_FORM_CONFIDENCE_THRESHOLD);
    expect(result.fieldCandidates).toHaveLength(0);
  });

  it("keeps a generic contact form below the offer threshold", () => {
    const doc = loadHtml(CONTACT_FORM);
    const result = detectApplicationForm(doc.body, "example.com");

    expect(result.isApplicationForm).toBe(false);
    expect(result.confidence).toBeLessThan(APPLICATION_FORM_CONFIDENCE_THRESHOLD);
    expect(result.fieldCandidates.map((c) => c.concept)).toEqual(
      expect.arrayContaining(["name", "email"]),
    );
  });
});
