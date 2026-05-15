"use client";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const TOKEN_TYPE_KEY = "token_type";
const ACCESS_TOKEN_EXPIRES_AT_KEY = "access_token_expires_at";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
};

export function saveAuthTokens(tokens: AuthTokens): void {
  if (!hasBrowserStorage()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  localStorage.setItem(TOKEN_TYPE_KEY, tokens.tokenType);
  localStorage.setItem(ACCESS_TOKEN_EXPIRES_AT_KEY, String(Date.now() + tokens.expiresInSeconds * 1000));
}

export function getAccessToken(): string | null {
  if (!hasBrowserStorage()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!hasBrowserStorage()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getAccessTokenExpiresAt(): number | null {
  if (!hasBrowserStorage()) return null;
  const value = localStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
  if (!value) return null;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function clearAuthTokens(): void {
  if (!hasBrowserStorage()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_TYPE_KEY);
  localStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
}

function hasBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}
