import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FLOATING_PANEL_EXPANDED_KEY,
  getPanelExpanded,
  setPanelExpanded,
} from "../../content/floating/panelState.js";
import { resetChromeStore } from "../setup.js";

describe("floating panel state persistence", () => {
  beforeEach(() => {
    resetChromeStore();
  });

  it("defaults to collapsed when nothing has been stored", async () => {
    expect(await getPanelExpanded()).toBe(false);
  });

  it("round-trips true/false via chrome.storage.session when available", async () => {
    await setPanelExpanded(true);
    expect(await getPanelExpanded()).toBe(true);

    const stored = await chrome.storage.session.get(FLOATING_PANEL_EXPANDED_KEY);
    expect(stored[FLOATING_PANEL_EXPANDED_KEY]).toBe(true);

    await setPanelExpanded(false);
    expect(await getPanelExpanded()).toBe(false);
  });

  describe("without chrome.storage.session (older Firefox)", () => {
    let originalSession: chrome.storage.StorageArea;

    beforeEach(() => {
      originalSession = chrome.storage.session;
      delete (chrome.storage as { session?: chrome.storage.StorageArea }).session;
    });

    afterEach(() => {
      Object.assign(chrome.storage, { session: originalSession });
    });

    it("falls back to chrome.storage.local for both write and read", async () => {
      await setPanelExpanded(true);
      expect(await getPanelExpanded()).toBe(true);

      const stored = await chrome.storage.local.get(FLOATING_PANEL_EXPANDED_KEY);
      expect(stored[FLOATING_PANEL_EXPANDED_KEY]).toBe(true);
    });
  });
});
