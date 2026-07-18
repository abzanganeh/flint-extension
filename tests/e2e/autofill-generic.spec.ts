import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect, test } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = readFileSync(
  join(__dirname, "../fixtures/autofill/generic/contact-application.html"),
  "utf8",
);
const HARNESS_JS = readFileSync(join(__dirname, "generated/autofill-test-harness.js"), "utf8");

const SAMPLE_PAYLOAD = {
  jd_id: "jd-generic-e2e",
  platform: "unknown" as const,
  fields: [
    {
      key: "first_name",
      selector: "",
      value: "Jordan Lee",
    },
    {
      key: "email",
      selector: "",
      value: "jordan@example.com",
    },
    {
      key: "phone",
      selector: "",
      value: "555-0199",
    },
    {
      key: "linkedin_url",
      selector: "",
      value: "https://www.linkedin.com/in/jordanlee",
    },
    {
      key: "resume",
      selector: "",
      value: "/tmp/resume.pdf",
    },
  ],
};

test("fills a non-Greenhouse generic form via heuristic fillApplicationForm", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(FIXTURE_HTML);
  await page.addScriptTag({ content: HARNESS_JS });

  const { platform, result } = await page.evaluate((payload) => {
    const detection = window.__flintAutofillTest!.detectApplicationForm(
      document.body,
      "careers.northwind.example",
    );
    const fillResult = window.__flintAutofillTest!.fillApplicationForm(
      payload,
      detection.fieldCandidates,
      document.body,
    );
    return { platform: detection.platform, result: fillResult };
  }, SAMPLE_PAYLOAD);

  expect(platform).toBe("unknown");

  // Heuristic matches are filled_needs_review; percent_filled only counts high-confidence.
  const byKey = Object.fromEntries(result.fields.map((f) => [f.key, f]));
  expect(byKey.first_name?.status).toBe("filled_needs_review");
  expect(byKey.email?.status).toBe("filled_needs_review");
  expect(byKey.phone?.status).toBe("filled_needs_review");
  expect(byKey.linkedin_url?.status).toBe("filled_needs_review");
  expect(byKey.resume?.status).toBe("not_applicable_file_upload");
  expect(
    result.fields.filter((f) => f.status === "filled_needs_review").length,
  ).toBeGreaterThanOrEqual(4);

  await expect(page.locator("#full_name")).toHaveValue("Jordan Lee");
  await expect(page.locator("#email")).toHaveValue("jordan@example.com");
  await expect(page.locator("#phone")).toHaveValue("555-0199");
  await expect(page.locator("#linkedin")).toHaveValue("https://www.linkedin.com/in/jordanlee");
  await expect(page.locator("#resume")).toHaveValue("");

  await browser.close();
});
