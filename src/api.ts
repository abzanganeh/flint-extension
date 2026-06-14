import type {
  ExtensionLoginResponse,
  SaveJDRequest,
  SaveJDResponse,
} from "./types.js";
import { clearAuth } from "./storage.js";

interface ViteImportMetaEnv {
  readonly env?: { readonly VITE_API_BASE_URL?: string };
}

// `import.meta.env` is provided by Vite at build time and by Vitest at test
// time. In raw service-worker / bare browser contexts it may be undefined,
// so we cast through `unknown` and read defensively. Casting through unknown
// satisfies TS without papering over a real structural mismatch.
const API_BASE: string =
  (typeof import.meta !== "undefined"
    ? (import.meta as unknown as ViteImportMetaEnv).env?.VITE_API_BASE_URL
    : undefined) ?? "http://localhost:8000";

// Contract: a 401 response anywhere in the API layer clears stored auth and
// throws AuthError. Callers MUST NOT call clearAuth themselves on a 401 —
// clearAuth is idempotent so a duplicate call is harmless, but relying on
// this contract keeps refresh / login / save paths uniform.
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
