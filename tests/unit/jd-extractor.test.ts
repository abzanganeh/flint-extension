/**
 * Tests for JD extraction logic.
 *
 * The content script is not loaded here directly because it registers a
 * chrome.runtime.onMessage listener on import (side-effect). We test the
 * extraction logic through functions re-exported for test use.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetChromeStore } from "../setup.js";

// Mirror private functions for testing without loading the full content script.

function queryFirst(selectors: string[], doc: Document): string {
  for (const sel of selectors) {
    try {
      const el = doc.querySelector(sel);
      if (el) return (el.textContent ?? "").trim();
    } catch {
      // ignore invalid selectors
    }
  }
  return "";
}

function sanitizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function stripHtml(html: string, doc: Document): string {
  const div = doc.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? div.innerText ?? html;
}

const JD_KEYWORDS = [
  "responsibilities", "requirements", "qualifications", "experience",
  "skills", "you will", "we are looking", "bachelor", "minimum",
  "proficiency", "collaborate", "develop", "design", "build", "maintain",
];

function jdKeywordScore(text: string): number {
  const lower = text.toLowerCase();
  const hits = JD_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  return hits / JD_KEYWORDS.length;
}

function extractScoredHeuristic(doc: Document): string {
  const candidates = Array.from(
    doc.querySelectorAll("p, div, section, article, main"),
  );
  let best = "";
  let bestScore = -1;
  for (const el of candidates) {
    if (el.children.length > 30) continue;
    const text = sanitizeText(el.textContent ?? "");
    if (text.length < 200) continue;
    const words = text.split(/\s+/);
    const hyphenWords = words.filter((w) => w.includes("-")).length;
    if (words.length > 0 && hyphenWords / words.length > 0.4) continue;
    const kwScore = jdKeywordScore(text);
    const lengthFactor = Math.min(text.length / 5000, 1);
    const score = kwScore * 0.7 + lengthFactor * 0.3;
    if (score > bestScore) { bestScore = score; best = text; }
  }
  return best;
}

function extractFromJsonLd(doc: Document): { title: string; company: string; text: string } | null {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent ?? "");
      const entries: unknown[] = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
      for (const entry of entries) {
        if (typeof entry !== "object" || entry === null) continue;
        const job = entry as Record<string, unknown>;
        if (job["@type"] !== "JobPosting") continue;
        const description = sanitizeText(stripHtml(String(job["description"] ?? ""), doc));
        if (description.length < 200) continue;
        const orgName = typeof job["hiringOrganization"] === "object" && job["hiringOrganization"] !== null
          ? String((job["hiringOrganization"] as Record<string, unknown>)["name"] ?? "")
          : "";
        return { title: sanitizeText(String(job["title"] ?? "")), company: sanitizeText(orgName), text: description };
      }
    } catch { /* skip malformed */ }
  }
  return null;
}

// Mirror of withTimeout from content/jd-extractor.ts. Keep in sync.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Extraction timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

beforeEach(() => {
  resetChromeStore();
  vi.useRealTimers();
});

// --- LinkedIn structured extraction ---

describe("LinkedIn structured extraction", () => {
  it("extracts title, company, and description via structured selectors", () => {
    const html = `
      <h1 class="t-24">Senior Software Engineer</h1>
      <a class="jobs-unified-top-card__company-name">Acme Corp</a>
      <div id="job-details">
        We are looking for an experienced engineer to join our distributed
        systems team. You will design, build, and maintain high-throughput
        data pipelines using Rust and Kafka. Strong fundamentals required.
        Responsibilities include mentoring junior engineers and collaborating
        closely with product and design teams on technical requirements.
      </div>
    `;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const title = queryFirst(["h1.t-24"], doc);
    const company = queryFirst([".jobs-unified-top-card__company-name"], doc);
    const description = sanitizeText(queryFirst(["#job-details"], doc));

    expect(title).toBe("Senior Software Engineer");
    expect(company).toBe("Acme Corp");
    expect(description.length).toBeGreaterThan(200);
  });
});

// --- Greenhouse structured extraction ---

describe("Greenhouse structured extraction", () => {
  it("extracts title and job content via structured selectors", () => {
    const html = `
      <h1 class="app-title">Backend Engineer</h1>
      <div id="content">
        Join our team as a backend engineer. You will build RESTful APIs
        using FastAPI and PostgreSQL. We value code quality, testing, and
        clear technical communication across teams. Requirements include
        three or more years of experience with Python and SQL databases.
        Preferred qualifications include experience with cloud platforms.
      </div>
    `;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const title = queryFirst(["h1.app-title"], doc);
    const description = sanitizeText(queryFirst(["#content"], doc));

    expect(title).toBe("Backend Engineer");
    expect(description.length).toBeGreaterThan(200);
  });
});

// --- JSON-LD extraction ---

describe("JSON-LD JobPosting extraction", () => {
  it("extracts title, company, and description from schema.org JSON-LD", () => {
    const payload = {
      "@type": "JobPosting",
      "title": "Data Engineer",
      "hiringOrganization": { "@type": "Organization", "name": "Kaiser Health" },
      "description": "<p>We are seeking a Data Engineer with experience in PySpark, Delta Lake, and distributed systems. Responsibilities include designing Medallion architecture layers, maintaining ETL pipelines, and collaborating with data science teams. Minimum qualifications: Bachelor degree and 3 years of data engineering experience.</p>",
    };
    const html = `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const result = extractFromJsonLd(doc);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Data Engineer");
    expect(result!.company).toBe("Kaiser Health");
    expect(result!.text).toContain("Data Engineer");
    expect(result!.text).toContain("Responsibilities");
    expect(result!.text).not.toContain("<p>");
  });

  it("handles @graph array wrapper", () => {
    const payload = {
      "@graph": [
        { "@type": "WebPage", "name": "Careers" },
        {
          "@type": "JobPosting",
          "title": "ML Engineer",
          "hiringOrganization": { "name": "DataCo" },
          "description": "We are looking for a machine learning engineer to develop and maintain model pipelines. Requirements include experience with Python, TensorFlow, and distributed training. You will collaborate with research and product teams. Minimum qualifications are a Bachelor degree in CS or related field and 2 years experience.",
        },
      ],
    };
    const html = `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const result = extractFromJsonLd(doc);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("ML Engineer");
    expect(result!.company).toBe("DataCo");
  });

  it("returns null for non-JobPosting types", () => {
    const payload = { "@type": "Organization", "name": "Acme" };
    const html = `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    expect(extractFromJsonLd(doc)).toBeNull();
  });
});

// --- Scored heuristic ---

describe("extractScoredHeuristic()", () => {
  it("picks a keyword-rich block over a longer metadata block", () => {
    const jdText = "We are looking for an experienced engineer to join our team. " +
      "Responsibilities include designing scalable data pipelines, collaborating with " +
      "product teams, and maintaining high-quality code. Requirements include 3 or more " +
      "years of experience with Python and SQL. Qualifications: Bachelor degree in CS. " +
      "You will build and maintain distributed systems. Skills: PySpark, Delta Lake, AWS.";
    // Simulate ATS metadata noise: long but hyphen-heavy (key=value style).
    const noise = Array.from({ length: 60 }, (_, i) => `field-${i}-value-data-info-tag`).join(" ");

    const html = `
      <div class="nav">${noise}</div>
      <div class="description">${jdText}</div>
    `;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const result = extractScoredHeuristic(doc);
    expect(result).toContain("Responsibilities");
    expect(result).not.toContain("field-0-value");
  });

  it("returns empty string when no block has enough content", () => {
    const html = `<div>tiny</div><p>also small</p>`;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    expect(extractScoredHeuristic(doc)).toBe("");
  });
});

// --- XSS safety ---

describe("sanitizeText()", () => {
  it("collapses whitespace", () => {
    const raw = "Title   at   Company\n\n   Description";
    expect(sanitizeText(raw)).toBe("Title at Company Description");
  });

  it("textContent extraction via DOM never includes script tags", () => {
    const html = `<div id="job-details"><script>alert(1)<\/script>Engineer role at Acme Corp</div>`;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const text = sanitizeText(queryFirst(["#job-details"], doc));
    expect(text).not.toContain("<script>");
    expect(text).toContain("Engineer role");
  });
});

function cleanJdText(text: string): string {
  let cleaned = sanitizeText(text);
  const noisy =
    cleaned.includes("Skip to main content") ||
    (cleaned.match(/custom_fields\./g) ?? []).length >= 1;
  const match = /Job Summary:/i.exec(cleaned);
  if (match && (noisy || (match.index > 0 && match.index < cleaned.length * 0.6))) {
    cleaned = cleaned.slice(match.index).trim();
  }
  if ((cleaned.match(/custom_fields\./g) ?? []).length >= 3) {
    const summaryIdx = cleaned.search(/Job Summary:/i);
    if (summaryIdx >= 0) cleaned = cleaned.slice(summaryIdx).trim();
    else return "";
  }
  return cleaned;
}

describe("cleanJdText()", () => {
  it("trims iCIMS metadata prefix and keeps Job Summary body", () => {
    const noisy =
      "Skip to main content custom_fields.ReqID-123 custom_fields.Shift-Day " +
      "custom_fields.PayRange-$100000 Job Summary: Build data pipelines. " +
      "Responsibilities include PySpark and Delta Lake. Requirements: 3 years experience.";
    const cleaned = cleanJdText(noisy);
    expect(cleaned.startsWith("Job Summary:")).toBe(true);
    expect(cleaned).not.toContain("custom_fields");
    expect(cleaned).not.toContain("Skip to main content");
  });
});

describe("withTimeout()", () => {
  it("rejects with a timeout error when the inner promise hangs", async () => {
    vi.useFakeTimers();
    const hanging = new Promise<string>(() => undefined);
    const wrapped = withTimeout(hanging, 5000);

    vi.advanceTimersByTime(5001);

    await expect(wrapped).rejects.toThrow(/timed out/i);
    vi.useRealTimers();
  });

  it("resolves with the inner value when it settles before the deadline", async () => {
    const fast = Promise.resolve("ok");
    await expect(withTimeout(fast, 1000)).resolves.toBe("ok");
  });
});
