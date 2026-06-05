import type { StoredAuth, UserInfo } from "./types.js";

const KEYS = {
  ACCESS_TOKEN: "sr_access_token",
  REFRESH_TOKEN: "sr_refresh_token",
  EXPIRES_AT: "sr_expires_at",
  USER: "sr_user",
} as const;

export async function saveAuth(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  user: UserInfo,
): Promise<void> {
  const expiresAt = Date.now() + expiresIn * 1000;
  await chrome.storage.local.set({
    [KEYS.ACCESS_TOKEN]: accessToken,
    [KEYS.REFRESH_TOKEN]: refreshToken,
    [KEYS.EXPIRES_AT]: expiresAt,
    [KEYS.USER]: user,
  });
}

export async function loadAuth(): Promise<StoredAuth | null> {
  const result = await chrome.storage.local.get([
    KEYS.ACCESS_TOKEN,
    KEYS.REFRESH_TOKEN,
    KEYS.EXPIRES_AT,
    KEYS.USER,
  ]);

  const { sr_access_token, sr_refresh_token, sr_expires_at, sr_user } = result;
  if (!sr_access_token || !sr_refresh_token || !sr_expires_at || !sr_user) {
    return null;
  }

  return {
    sr_access_token,
    sr_refresh_token,
    sr_expires_at,
    sr_user,
  };
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([
    KEYS.ACCESS_TOKEN,
    KEYS.REFRESH_TOKEN,
    KEYS.EXPIRES_AT,
    KEYS.USER,
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(KEYS.ACCESS_TOKEN);
  return (result[KEYS.ACCESS_TOKEN] as string | undefined) ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(KEYS.REFRESH_TOKEN);
  return (result[KEYS.REFRESH_TOKEN] as string | undefined) ?? null;
}

export async function getExpiresAt(): Promise<number | null> {
  const result = await chrome.storage.local.get(KEYS.EXPIRES_AT);
  return (result[KEYS.EXPIRES_AT] as number | undefined) ?? null;
}

export async function updateAccessToken(
  accessToken: string,
  expiresIn: number,
): Promise<void> {
  const expiresAt = Date.now() + expiresIn * 1000;
  await chrome.storage.local.set({
    [KEYS.ACCESS_TOKEN]: accessToken,
    [KEYS.EXPIRES_AT]: expiresAt,
  });
}
