"use client";

import { clearAuthTokens, getAccessToken, getAccessTokenExpiresAt, getRefreshToken, saveAuthTokens } from "@/lib/auth-client";
import { normalizeBackendError, type BackendErrorKey } from "@/lib/backend-error-normalizer";

export const SESSION_EXPIRED_EVENT = "auth:session-expired";
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";

type ApiErrorPayload = {
  code?: string;
  message?: string;
  detail?: string;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  detail?: string;
  details?: unknown;
  payload?: unknown;
  normalizedKey: BackendErrorKey;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
    detail?: string,
    payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.details = details;
    this.payload = payload;
    this.normalizedKey = normalizeBackendError(this).key;
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
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      notifySessionExpired();
      throw new ApiError(SESSION_EXPIRED_MESSAGE, 401, "session_expired");
    }
  }

  const requestPath = path.startsWith("/api/") ? path : `/api/v1${path}`;
  const response = await fetch(requestPath, {
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

  if (!finalHeaders.has("Content-Type") && body && !(body instanceof FormData)) {
    finalHeaders.set("Content-Type", "application/json");
  }

  if (withAuth) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      notifySessionExpired();
      throw new ApiError(SESSION_EXPIRED_MESSAGE, 401, "session_expired");
    }
    finalHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  return finalHeaders;
}

async function readApiError(response: Response) {
  let errorMessage = `Request failed (${response.status})`;
  let errorCode: string | undefined;
  let errorDetail: string | undefined;
  let errorDetails: unknown;
  let errorPayload: unknown;

  try {
    const payload = (await response.json()) as ApiErrorPayload;
    errorPayload = payload;
    errorMessage = payload.message ?? errorMessage;
    if (typeof payload.detail === "string") {
      errorDetail = payload.detail;
      errorMessage = payload.message ?? payload.detail;
    }
    errorCode = payload.code;
    errorDetails = payload.details;
  } catch {
    // Keep fallback message when response is not JSON.
  }

  return new ApiError(errorMessage, response.status, errorCode, errorDetails, errorDetail, errorPayload);
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
    notifySessionExpired();
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

function notifySessionExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIRED_EVENT, {
      detail: { code: "session_expired", message: SESSION_EXPIRED_MESSAGE },
    }),
  );
}
