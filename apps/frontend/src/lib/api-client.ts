"use client";

import { clearAuthTokens, getAccessToken, getAccessTokenExpiresAt, getRefreshToken, saveAuthTokens } from "@/lib/auth-client";

type ApiErrorPayload = {
  code?: string;
  message?: string;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type ApiFetchOptions = RequestInit & {
  withAuth?: boolean;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  return apiFetchWithRetry<T>(path, options, true);
}

async function apiFetchWithRetry<T>(path: string, options: ApiFetchOptions, allowRefresh: boolean): Promise<T> {
  const { withAuth = false, headers, ...rest } = options;
  if (withAuth && allowRefresh && path !== "/auth/refresh" && shouldRefreshBeforeRequest()) {
    await refreshAccessToken();
  }

  const response = await fetch(`/api/v1${path}`, {
    ...rest,
    headers: buildHeaders(headers, rest.body, withAuth),
  });

  if (!response.ok) {
    const error = await readApiError(response);
    if (withAuth && allowRefresh && shouldRefreshAccessToken(error) && path !== "/auth/refresh") {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiFetchWithRetry<T>(path, options, false);
      }
    }

    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

function shouldRefreshBeforeRequest() {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  const expiresAt = getAccessTokenExpiresAt();

  if (!refreshToken) return false;
  if (!accessToken) return true;
  if (!expiresAt) return false;

  return expiresAt <= Date.now() + 30_000;
}

function buildHeaders(headers: HeadersInit | undefined, body: BodyInit | null | undefined, withAuth: boolean) {
  const finalHeaders = new Headers(headers ?? {});

  if (!finalHeaders.has("Content-Type") && body) {
    finalHeaders.set("Content-Type", "application/json");
  }

  if (withAuth) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new ApiError("Bạn chưa đăng nhập.", 401, "unauthorized");
    }
    finalHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  return finalHeaders;
}

async function readApiError(response: Response) {
  let errorMessage = `Request failed (${response.status})`;
  let errorCode: string | undefined;
  let errorDetails: unknown;

  try {
    const payload = (await response.json()) as ApiErrorPayload;
    errorMessage = payload.message ?? errorMessage;
    errorCode = payload.code;
    errorDetails = payload.details;
  } catch {
    // Keep fallback message when response is not JSON.
  }

  return new ApiError(errorMessage, response.status, errorCode, errorDetails);
}

function shouldRefreshAccessToken(error: ApiError) {
  const message = error.message.toLowerCase();
  return (
    error.status === 401 ||
    error.status === 403 ||
    (error.status === 422 &&
      error.code === "validation_error" &&
      (message.includes("invalid jwt expiration") ||
        message.includes("invalid access token") ||
        message.includes("invalid jwt")))
  );
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const response = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    clearAuthTokens();
    return false;
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };

  saveAuthTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type,
    expiresInSeconds: data.expires_in,
  });
  return true;
}
