import { describe, expect, it } from "vitest";
import { pickSessionMatch } from "../../src/sessionMatcher.js";

describe("pickSessionMatch", () => {
  const sessions = [
    {
      jd_id: "jd-a",
      title: "Backend Engineer",
      company: "Acme",
      url_host: "boards.greenhouse.io",
      tailored_at: "2026-07-15T00:00:00Z",
    },
    {
      jd_id: "jd-b",
      title: "Platform Engineer",
      company: "Beta",
      url_host: "boards.greenhouse.io",
      tailored_at: "2026-07-14T00:00:00Z",
    },
    {
      jd_id: "jd-c",
      title: "Data Engineer",
      company: "Gamma",
      url_host: "jobs.lever.co",
      tailored_at: "2026-07-13T00:00:00Z",
    },
  ];

  it("returns a picker when multiple sessions share the same host", () => {
    const match = pickSessionMatch(sessions, "boards.greenhouse.io");
    expect(match.kind).toBe("picker");
  });

  it("returns a single match for a unique host", () => {
    const match = pickSessionMatch(sessions, "jobs.lever.co");
    expect(match.kind).toBe("single");
    if (match.kind === "single") {
      expect(match.session.jd_id).toBe("jd-c");
    }
  });

  it("returns none when no host matches", () => {
    const match = pickSessionMatch(sessions, "example.com");
    expect(match.kind).toBe("none");
  });
});
