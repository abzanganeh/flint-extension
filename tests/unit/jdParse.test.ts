import { describe, expect, it } from "vitest";
import {
  cleanJdText,
  extractJobPostingFromHtml,
  finalizeJdText,
  isJobAggregatorNoise,
  pickBetterJd,
  scoreJdText,
  stripJobAggregatorNoise,
} from "../../src/jdParse.js";

const SAMPLE_JSON_LD = {
  "@type": "JobPosting",
  title: "Data Engineer",
  hiringOrganization: { name: "Kaiser Permanente" },
  description:
    "<p><strong>Job Summary:</strong> As an individual contributor, you will take ownership of challenging technical initiatives. " +
    "Responsibilities include building PySpark pipelines and Delta Lake architectures. " +
    "Requirements include three years of software development experience and proficiency with Python and SQL. " +
    "Preferred qualifications include Databricks experience and cloud platform knowledge across Azure environments.</p>",
};

describe("cleanJdText", () => {
  it("keeps Job Summary when it precedes Responsibilities in the same text", () => {
    const text =
      "Job Summary: As an individual contributor, you will take ownership of challenging initiatives. " +
      "Responsibilities and Accountabilities: Develop pipelines using PySpark and Delta Live Tables.";
    const cleaned = cleanJdText(text);
    expect(cleaned.startsWith("Job Summary:")).toBe(true);
  });
});

describe("extractJobPostingFromHtml", () => {
  it("parses JobPosting JSON-LD from fetched HTML", () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(SAMPLE_JSON_LD)}</script></head><body></body></html>`;
    const result = extractJobPostingFromHtml(html);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Data Engineer");
    expect(result!.company).toBe("Kaiser Permanente");
    expect(result!.text.startsWith("Job Summary:")).toBe(true);
  });

  it("formats Jobright JSON-LD HTML with bullets and no remote note", () => {
    const jobrightLd = {
      "@type": "JobPosting",
      title: "[Remote] Machine Learning Engineer",
      hiringOrganization: { name: "Calendly" },
      description:
        "<p>Note: The job is a remote job and is open to candidates in USA. Calendly is hiring an ML engineer " +
        "to build production machine learning features across the platform.</p>" +
        "<p>Responsibilities</p><ul>" +
        "<li>Own ML powered features from design through deployment</li>" +
        "<li>Prioritize your work independently and communicate tradeoffs clearly</li>" +
        "<li>Participate in on-call rotation and incident response</li>" +
        "</ul><p>Skills</p><ul>" +
        "<li>4+ years of industry experience in applied Machine Learning</li>" +
        "<li>Strong programming in Python, Scala, Java, or SQL</li>" +
        "<li>Proficiency in TensorFlow, PyTorch, or Keras</li>" +
        "</ul><p>Benefits</p><ul><li>Equity awards and competitive benefits</li></ul>",
    };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(jobrightLd)}</script></head></html>`;
    const result = extractJobPostingFromHtml(html);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Machine Learning Engineer");
    expect(result!.text).not.toMatch(/^Note:/i);
    expect(result!.text).toContain("- Own ML powered features");
    expect(result!.text).toMatch(/Required Qualifications/i);
  });
});

describe("pickBetterJd", () => {
  it("prefers full Job Summary over partial Responsibilities slice", () => {
    const full = {
      title: "Data Engineer",
      company: "Kaiser",
      text:
        "Job Summary: Lead data engineering initiatives across enterprise platforms. " +
        "Responsibilities include PySpark pipeline development and Delta Lake architecture. " +
        "Requirements include three years of software development experience and proficiency with Python and SQL. " +
        "Preferred qualifications include Databricks experience and cloud platform knowledge across Azure environments. " +
        "You will collaborate with cross-functional teams to deliver scalable data solutions.",
    };
    const partial = {
      title: "Data Engineer",
      company: "",
      text:
        "Responsibilities and Accountabilities: Develop pipelines using PySpark and Delta Live Tables. " +
        "Essential Responsibilities: Completes work assignments by applying up-to-date knowledge in subject matter. " +
        "Develops and maintains data integration processes. Participates in design and code reviews. " +
        "Supports production systems and troubleshoots data quality issues across multiple environments.",
    };
    expect(scoreJdText(full.text)).toBeGreaterThan(scoreJdText(partial.text));
    expect(pickBetterJd(full, partial)?.text).toBe(full.text);
  });

  it("prefers JSON-LD over Jobright aggregator DOM noise", () => {
    const jsonld = {
      title: "Machine Learning Engineer",
      company: "Calendly",
      text:
        "Calendly is a company that relies on innovation in data, analytics, and AI. " +
        "Responsibilities: Own ML powered features from design through deployment. " +
        "Qualifications: 4+ years of industry experience in applied Machine Learning. " +
        "Required: Strong programming in Python and SQL. Benefits: Equity awards.",
    };
    const noisy =
      "JobsResumeProfileAgent Apply with Autofill Overview Company 71% GOOD MATCH " +
      jsonld.text +
      " Hidden Jobs Recommended Why this job is a match ASK ORION Apply with Autofill " +
      "Software Engineer II GitHub Why this job is a match ASK ORION";
    expect(isJobAggregatorNoise(noisy)).toBe(true);
    const picked = pickBetterJd(jsonld, { title: "ML Engineer", company: "", text: noisy });
    expect(picked?.text.length).toBeLessThan(2000);
    expect(picked?.text).not.toMatch(/Hidden Jobs/i);
    expect(scoreJdText(jsonld.text)).toBeGreaterThan(scoreJdText(noisy));
  });
});

describe("stripJobAggregatorNoise", () => {
  it("removes Jobright nav chrome and sidebar job feed", () => {
    const noisy =
      "JobsResumeProfile Apply with Autofill Overview Company Calendly Machine Learning Engineer " +
      "71% GOOD MATCH Calendly is a company that relies on innovation in data, analytics, and AI. " +
      "Responsibilities Own ML powered features from design through deployment. " +
      "Qualification Required 4+ years of industry experience. Benefits Equity awards. " +
      "Company Calendly Founded in 2013 Hidden Jobs Recommended Why this job is a match ASK ORION";
    const cleaned = stripJobAggregatorNoise(noisy);
    expect(cleaned.startsWith("Calendly is a company")).toBe(true);
    expect(cleaned).not.toMatch(/Hidden Jobs/i);
    expect(cleaned).not.toMatch(/ASK ORION/i);
    expect(cleaned.length).toBeLessThan(noisy.length);
  });
});
