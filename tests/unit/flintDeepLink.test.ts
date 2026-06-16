import { describe, expect, it } from "vitest";

import {
  buildFlintHandoffTabUrl,
  buildFlintImportDeepLink,
} from "../../src/flintDeepLink.js";

describe("flintDeepLink", () => {
  it("builds flint import URL with encoded token", () => {
    const token = "550e8400-e29b-41d4-a716-446655440000";
    expect(buildFlintImportDeepLink(token)).toBe(
      "flint://import?token=550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("builds handoff tab URL pointing at extension handoff page", () => {
    const token = "abc-123";
    const url = buildFlintHandoffTabUrl(token);
    expect(url).toContain("handoff/index.html?target=");
    expect(decodeURIComponent(url)).toContain("flint://import?token=abc-123");
  });
});
