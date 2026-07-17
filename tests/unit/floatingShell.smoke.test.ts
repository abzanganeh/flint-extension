import { describe, expect, it } from "vitest";
import { FloatingShell } from "../../content/floating/shell.js";
import { FLOATING_PANEL_EXPANDED_KEY, getPanelExpanded, setPanelExpanded } from "../../content/floating/panelState.js";

describe("floating panel module exports (smoke)", () => {
  it("exposes the FloatingShell class with its public API", () => {
    expect(typeof FloatingShell).toBe("function");
    const shell = new FloatingShell();
    expect(typeof shell.mount).toBe("function");
    expect(typeof shell.expand).toBe("function");
    expect(typeof shell.collapse).toBe("function");
    expect(typeof shell.toggle).toBe("function");
    expect(typeof shell.isExpanded).toBe("function");
    expect(typeof shell.restorePersistedState).toBe("function");
    expect(typeof shell.destroy).toBe("function");
    expect(shell.isExpanded()).toBe(false);
  });

  it("exposes panelState get/set helpers and the storage key", () => {
    expect(typeof FLOATING_PANEL_EXPANDED_KEY).toBe("string");
    expect(typeof getPanelExpanded).toBe("function");
    expect(typeof setPanelExpanded).toBe("function");
  });
});
