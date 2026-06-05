import type {
  ExtensionLoginResponse,
  SaveJDRequest,
  SaveJDResponse,
} from "./types.js";
import { clearAuth } from "./storage.js";

const API_BASE = (
  typeof import.meta !== "undefined"
    ? (import.meta as Record<string, Record<string, string>>).env
        ?.VITE_API_BASE_URL
    : undefined
) ?? "http://localhost:8000";

async function request<T>(
  path: string,
  options: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 401) {
    await clearAuth();
    throw new AuthError("Session expired — please log in again.");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApiError(response.status, body);
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<ExtensionLoginResponse> {
  return request<ExtensionLoginResponse>("/api/auth/extension/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiRefresh(
  refreshToken: string,
): Promise<ExtensionLoginResponse> {
  return request<ExtensionLoginResponse>("/api/auth/extension/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function apiSaveJD(
  payload: SaveJDRequest,
  accessToken: string,
): Promise<SaveJDResponse> {
  return request<SaveJDResponse>("/api/job-descriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
}
