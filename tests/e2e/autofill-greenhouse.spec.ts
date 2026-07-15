import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect, test } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = readFileSync(
  join(__dirname, "../fixtures/autofill/greenhouse/apply-form.html"),
  "utf8",
);
const HARNESS_JS = readFileSync(join(__dirname, "generated/autofill-test-harness.js"), "utf8");

const SAMPLE_PAYLOAD = {
  jd_id: "jd-e2e",
  platform: "greenhouse" as const,
  fields: [
    {
      key: "first_name",
      selector: "[name='job_application[first_name]']",
      value: "Jordan",
    },
    {
      key: "last_name",
      selector: "[name='job_application[last_name]']",
      value: "Lee",
    },
    {
      key: "email",
      selector: "[name='job_application[email]']",
      value: "jordan@example.com",
    },
    {
      key: "phone",
      selector: "[name='job_application[phone]']",
      value: "555-0199",
    },
    {
      key: "resume",
      selector: "[name='job_application[resume]']",
      value: "/tmp/resume.pdf",
    },
  ],
};

test("fills Greenhouse fixture fields in a real browser context", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(FIXTURE_HTML);
  await page.addScriptTag({ content: HARNESS_JS });

  const result = await page.evaluate((payload) => {
    return window.__flintAutofillTest!.fillGreenhouse(payload);
  }, SAMPLE_PAYLOAD);

  expect(result.percent_filled).toBeGreaterThanOrEqual(75);
  expect(result.fields.find((f) => f.key === "resume")?.status).toBe("not_applicable_file_upload");

  await expect(page.locator("[name='job_application[email]']")).toHaveValue("jordan@example.com");
  await expect(page.locator("[name='job_application[first_name]']")).toHaveValue("Jordan");

  await browser.close();
});
