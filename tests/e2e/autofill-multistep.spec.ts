import { chromium, expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_JS = readFileSync(join(__dirname, "generated/autofill-test-harness.js"), "utf8");

const MULTISTEP_PAGE = `
<!DOCTYPE html>
<html lang="en">
  <body>
    <div id="wizard">
      <form id="step-1">
        <input name="job_application[first_name]" placeholder="First Name" value="" />
        <input name="job_application[last_name]" placeholder="Last Name" value="" />
        <input name="job_application[email]" type="email" placeholder="Email" value="" />
        <input name="job_application[phone]" type="tel" placeholder="Phone" value="" />
        <button type="button" id="next-step">Next</button>
      </form>
    </div>
    <script>
      document.getElementById('next-step').addEventListener('click', () => {
        document.getElementById('wizard').innerHTML = \`
          <form id="step-2">
            <input name="job_application[linkedin]" placeholder="LinkedIn profile" value="" />
            <input name="job_application[resume]" type="file" aria-label="Resume/CV" />
            <select name="job_application[answers][work_authorization]">
              <option value="">Select…</option>
              <option value="yes">Yes</option>
            </select>
          </form>
        \`;
      });
    </script>
  </body>
</html>
`;

test("re-offers autofill on step 2 after the user advances the wizard manually", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(MULTISTEP_PAGE);
  await page.addScriptTag({ content: HARNESS_JS });

  await page.evaluate(() => {
    window.__flintMultistepProbe = window.__flintAutofillTest!.mountMultistepProbe();
  });

  expect(await page.evaluate(() => window.__flintMultistepProbe!.getEvents())).toContain("step1-offer");

  await page.click("#next-step");
  await page.waitForSelector("#step-2");
  await page.waitForTimeout(200);

  const probe = await page.evaluate(() => ({
    events: window.__flintMultistepProbe!.getEvents(),
    view: window.__flintMultistepProbe!.getView(),
  }));

  expect(probe.events).toContain("step-change");
  expect(probe.events).toContain("re-offer");
  expect(probe.view).toBe("offer");

  await browser.close();
});

declare global {
  interface Window {
    __flintMultistepProbe?: {
      getView: () => string;
      getEvents: () => string[];
      destroy: () => void;
    };
  }
}
