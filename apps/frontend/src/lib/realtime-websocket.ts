"use client";

const DEFAULT_BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

type RealtimeWebSocketUrlOptions = {
  token?: string | null;
  channels?: string[];
};

export function buildRealtimeWebSocketUrl({
  token,
  channels = [],
}: RealtimeWebSocketUrlOptions) {
  const params = new URLSearchParams();
  if (token) {
    params.set("token", token);
  }
  if (channels.length > 0) {
    params.set("channels", channels.join(","));
  }

  return `${getRealtimeWebSocketBaseUrl()}/api/ws/v1/realtime${params.size > 0 ? `?${params.toString()}` : ""}`;
}

function getRealtimeWebSocketBaseUrl() {
  try {
    const baseUrl = new URL(
      DEFAULT_BACKEND_BASE_URL,
      typeof window !== "undefined" ? window.location.origin : "http://localhost:8000",
    );
    baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
    return baseUrl.toString().replace(/\/$/, "");
  } catch {
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      return `${protocol}://${window.location.hostname}:8000`;
    }
    return "ws://localhost:8000";
  }
}
