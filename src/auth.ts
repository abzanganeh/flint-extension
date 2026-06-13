import type { UserInfo } from "./types.js";
import { apiGoogleCallback, apiLogin, apiRefresh } from "./api.js";
import { buildGoogleAuthUrl } from "./urls.js";
import {
  clearAuth,
  getAccessToken,
  getExpiresAt,
  getRefreshToken,
  saveAuth,
  updateAccessToken,
} from "./storage.js";

const ALARM_NAME = "token-refresh";
const REFRESH_INTERVAL_MINUTES = 25;

// Tokens within this window (ms) of expiry are considered stale.
const EXPIRY_BUFFER_MS = 2 * 60 * 1000;

export async function login(email: string, password: string): Promise<UserInfo> {
  const data = await apiLogin(email, password);
  await saveAuth(data.access_token, data.refresh_token, data.expires_in, data.user);
  await _registerRefreshAlarm();
  return data.user;
}

export async function loginWithGoogle(): Promise<UserInfo> {
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = buildGoogleAuthUrl(redirectUri);

  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (url) => {
        if (chrome.runtime.lastError ?? !url) {
          reject(new Error(chrome.runtime.lastError?.message ?? "OAuth cancelled"));
        } else {
          resolve(url);
        }
      },
    );
  });

  const url = new URL(responseUrl);
  const code = url.searchParams.get("code");
  if (!code) {
    throw new Error("No authorization code returned from Google");
  }

  const data = await apiGoogleCallback(code, redirectUri);
  await saveAuth(data.access_token, data.refresh_token, data.expires_in, data.user);
  await _registerRefreshAlarm();
  return data.user;
}

export async function logout(): Promise<void> {
  await clearAuth();
  await chrome.alarms.clear(ALARM_NAME);
}

export async function getAccessTokenOrNull(): Promise<string | null> {
  await refreshIfNeeded();
  return getAccessToken();
}

export async function refreshIfNeeded(): Promise<void> {
  const expiresAt = await getExpiresAt();
  if (expiresAt === null) return;

  const isStale = Date.now() >= expiresAt - EXPIRY_BUFFER_MS;
  if (!isStale) return;

  await _doRefresh();
}

export async function handleRefreshAlarm(alarmName: string): Promise<void> {
  if (alarmName !== ALARM_NAME) return;
  await _doRefresh();
}

async function _doRefresh(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return;

  try {
    const data = await apiRefresh(refreshToken);
    // Rotate both tokens on success.
    await saveAuth(data.access_token, data.refresh_token, data.expires_in, data.user);
  } catch {
    // Refresh failure means the session is gone; clear credentials so the
    // popup shows the login form on next open.
    await clearAuth();
    await chrome.alarms.clear(ALARM_NAME);
  }
}

async function _registerRefreshAlarm(): Promise<void> {
  // Clears any existing alarm before re-registering so we do not stack
  // duplicates after re-login.
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: REFRESH_INTERVAL_MINUTES });
}

export async function ensureRefreshAlarmRegistered(): Promise<void> {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (existing) return;

  const token = await getRefreshToken();
  if (token) {
    await _registerRefreshAlarm();
  }
}
