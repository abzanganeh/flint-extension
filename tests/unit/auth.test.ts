import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetChromeStore } from "../setup.js";
import {
  login,
  logout,
  getAccessTokenOrNull,
  refreshIfNeeded,
  ensureRefreshAlarmRegistered,
} from "../../src/auth.js";
import * as api from "../../src/api.js";
import * as storage from "../../src/storage.js";

const MOCK_USER = { id: "u1", email: "a@b.com", display_name: "A" };

function mockLoginResponse(overrides: Partial<ReturnType<typeof api.apiLogin> extends Promise<infer T> ? T : never> = {}) {
  return {
    access_token: "tok_access",
    refresh_token: "tok_refresh",
    expires_in: 900,
    user: MOCK_USER,
    ...overrides,
  };
}

beforeEach(() => {
  resetChromeStore();
  vi.restoreAllMocks();
});

describe("login()", () => {
  it("stores tokens and registers the refresh alarm", async () => {
    vi.spyOn(api, "apiLogin").mockResolvedValue(mockLoginResponse());

    const user = await login("a@b.com", "password123");

    expect(user).toEqual(MOCK_USER);

    const stored = await storage.getAccessToken();
    expect(stored).toBe("tok_access");

    const alarm = await chrome.alarms.get("token-refresh");
    expect(alarm).toBeDefined();
    expect(alarm?.name).toBe("token-refresh");
  });
});

describe("logout()", () => {
  it("clears storage and cancels the alarm", async () => {
    vi.spyOn(api, "apiLogin").mockResolvedValue(mockLoginResponse());
    await login("a@b.com", "pw");

    await logout();

    const token = await storage.getAccessToken();
    expect(token).toBeNull();

    const alarm = await chrome.alarms.get("token-refresh");
    expect(alarm).toBeUndefined();
  });
});

describe("getAccessTokenOrNull()", () => {
  it("returns null when not logged in", async () => {
    const token = await getAccessTokenOrNull();
    expect(token).toBeNull();
  });

  it("returns the access token when not expired", async () => {
    vi.spyOn(api, "apiLogin").mockResolvedValue(mockLoginResponse());
    await login("a@b.com", "pw");

    const token = await getAccessTokenOrNull();
    expect(token).toBe("tok_access");
  });
});

describe("refreshIfNeeded()", () => {
  it("refreshes when token is within expiry buffer", async () => {
    // Set an already-expired expires_at.
    await storage.saveAuth("old_access", "old_refresh", -1, MOCK_USER);

    vi.spyOn(api, "apiRefresh").mockResolvedValue(
      mockLoginResponse({ access_token: "new_access", refresh_token: "new_refresh" }),
    );

    await refreshIfNeeded();

    const token = await storage.getAccessToken();
    expect(token).toBe("new_access");
  });

  it("clears auth when refresh fails", async () => {
    await storage.saveAuth("old_access", "old_refresh", -1, MOCK_USER);

    vi.spyOn(api, "apiRefresh").mockRejectedValue(new Error("401"));

    await refreshIfNeeded();

    const token = await storage.getAccessToken();
    expect(token).toBeNull();
  });
});

describe("ensureRefreshAlarmRegistered()", () => {
  it("registers alarm when a refresh token is stored", async () => {
    await storage.saveAuth("access", "refresh", 900, MOCK_USER);

    await ensureRefreshAlarmRegistered();

    const alarm = await chrome.alarms.get("token-refresh");
    expect(alarm).toBeDefined();
  });

  it("does not register alarm when no refresh token exists", async () => {
    await ensureRefreshAlarmRegistered();

    const alarm = await chrome.alarms.get("token-refresh");
    expect(alarm).toBeUndefined();
  });
});
