import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectApplicationForm } from "../../content/autofill/detector.js";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/autofill/greenhouse");

function loadFixture(name: string): Document {
  const html = readFileSync(join(FIXTURE_DIR, name), "utf8");
  const doc = document.implementation.createHTMLDocument("fixture");
  doc.documentElement.innerHTML = html.replace(/^[\s\S]*<body[^>]*>/i, "").replace(/<\/body>[\s\S]*$/i, "");
  // Preserve full body content from the file.
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  doc.body.innerHTML = bodyMatch?.[1] ?? html;
  return doc;
}

describe("Greenhouse application-form fixtures", () => {
  it("parses first/last name, email, phone, and a file input", () => {
    const doc = loadFixture("apply-form.html");

    expect(doc.querySelector("[name='job_application[first_name]']")).not.toBeNull();
    expect(doc.querySelector("[name='job_application[last_name]']")).not.toBeNull();
    expect(doc.querySelector("[name='job_application[email]']")).not.toBeNull();
    expect(doc.querySelector("[name='job_application[phone]']")).not.toBeNull();
    expect(doc.querySelector("input[type='file']")).not.toBeNull();
  });

  it("registers as an application form when scored by the detector", () => {
    const doc = loadFixture("apply-form.html");
    const result = detectApplicationForm(doc.body, "boards.greenhouse.io");
    expect(result.isApplicationForm).toBe(true);
    expect(result.platform).toBe("greenhouse");
  });
});
