import { beforeEach, describe, expect, it, vi } from "vitest";
import { injectAndExpandFloatingPanel } from "../../src/floatingPanelInject.js";

function installChromeMocks(overrides: {
  sendMessage?: (tabId: number, message: unknown) => Promise<unknown>;
  executeScript?: (details: chrome.scripting.ScriptInjection<unknown[], unknown>) => Promise<unknown>;
}): {
  sendMessage: ReturnType<typeof vi.fn>;
  executeScript: ReturnType<typeof vi.fn>;
} {
  const sendMessage = vi.fn(overrides.sendMessage ?? (() => Promise.resolve({ ok: true })));
  const executeScript = vi.fn(overrides.executeScript ?? (() => Promise.resolve([])));

  Object.assign(chrome, {
    tabs: { sendMessage },
    scripting: { executeScript },
  });

  return { sendMessage, executeScript };
}

describe("injectAndExpandFloatingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when the tab has no id", async () => {
    const { sendMessage, executeScript } = installChromeMocks({});

    await injectAndExpandFloatingPanel(undefined);

    expect(sendMessage).not.toHaveBeenCalled();
    expect(executeScript).not.toHaveBeenCalled();
  });

  it("expands via message alone when a runner is already listening", async () => {
    const { sendMessage, executeScript } = installChromeMocks({
      sendMessage: () => Promise.resolve({ ok: true }),
    });

    await injectAndExpandFloatingPanel(7);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(7, { type: "EXPAND_FLOATING_PANEL" });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it("injects the floating shell then retries the message when none was listening", async () => {
    let call = 0;
    const { sendMessage, executeScript } = installChromeMocks({
      sendMessage: () => {
        call += 1;
        return call === 1 ? Promise.reject(new Error("no listener")) : Promise.resolve({ ok: true });
      },
    });

    await injectAndExpandFloatingPanel(9);

    expect(executeScript).toHaveBeenCalledTimes(1);
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 9 },
      files: ["content/floating-shell.js"],
    });
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it("gives up quietly when script injection fails on a restricted page", async () => {
    const { sendMessage, executeScript } = installChromeMocks({
      sendMessage: () => Promise.reject(new Error("no listener")),
      executeScript: () => Promise.reject(new Error("Cannot access a chrome:// URL")),
    });

    await expect(injectAndExpandFloatingPanel(11)).resolves.toBeUndefined();
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(executeScript).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent inject calls for the same tab", async () => {
    let resolveInject: (() => void) | undefined;
    const { sendMessage, executeScript } = installChromeMocks({
      sendMessage: () => Promise.reject(new Error("no listener")),
      executeScript: () =>
        new Promise((resolve) => {
          resolveInject = () => resolve([]);
        }),
    });

    const first = injectAndExpandFloatingPanel(13);
    const second = injectAndExpandFloatingPanel(13);

    // Let sendMessage reject and reach executeScript before asserting.
    await vi.waitFor(() => {
      expect(executeScript).toHaveBeenCalledTimes(1);
    });

    resolveInject?.();
    await Promise.all([first, second]);
    expect(executeScript).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalled();
  });
});
