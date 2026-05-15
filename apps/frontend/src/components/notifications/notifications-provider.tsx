"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useRealtimeBusinessEvents } from "@/hooks/useRealtimeBusinessEvents";
import { getAccessToken } from "@/lib/auth-client";
import { mergeNotificationItems, toNotificationItem } from "@/lib/realtime-notifications";
import type { NotificationItem, RealtimeBusinessEvent, WebSocketConnectionStatus } from "@/lib/types";

type NotificationsContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  connectionStatus: WebSocketConnectionStatus;
  activeToasts: NotificationItem[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissToast: (id: string) => void;
};

const STORAGE_KEY = "realtime_notifications";

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

type PersistedNotificationsState = {
  items: NotificationItem[];
  lastReceivedAt: string | null;
};

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const enabled = pathname !== "/login";
  const token = enabled ? getAccessToken() : null;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [activeToasts, setActiveToasts] = useState<NotificationItem[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<WebSocketConnectionStatus>("disconnected");
  const [lastReceivedAt, setLastReceivedAt] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const itemsRef = useRef<NotificationItem[]>([]);

  useEffect(() => {
    const persistedState = loadPersistedNotifications();
    const hydrationTimer = window.setTimeout(() => {
      setItems(persistedState.items);
      setLastReceivedAt(persistedState.lastReceivedAt);
      setIsHydrated(true);
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    const persistedState: PersistedNotificationsState = { items, lastReceivedAt };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  }, [isHydrated, items, lastReceivedAt]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const appendEvents = useCallback((events: RealtimeBusinessEvent[], source: "live" | "catchup") => {
    const incomingItems = events
      .map(toNotificationItem)
      .filter((item): item is NotificationItem => item !== null);
    if (incomingItems.length === 0) return;
    const merged = mergeNotificationItems(itemsRef.current, incomingItems);
    itemsRef.current = merged.items;
    setItems(merged.items);

    if (source === "live" && merged.appendedItems.length > 0) {
      setActiveToasts((currentToasts) => [...merged.appendedItems, ...currentToasts].slice(0, 3));
    }
  }, []);

  const handleLiveEvents = useCallback((events: RealtimeBusinessEvent[]) => {
    appendEvents(events, "live");
  }, [appendEvents]);

  const handleCatchupEvents = useCallback((events: RealtimeBusinessEvent[]) => {
    appendEvents(events, "catchup");
  }, [appendEvents]);

  const markAsRead = useCallback((id: string) => {
    setItems((currentItems) => currentItems.map((item) => (item.id === id ? { ...item, read: true } : item)));
    setActiveToasts((currentToasts) => currentToasts.filter((item) => item.id !== id));
  }, []);

  const markAllAsRead = useCallback(() => {
    setItems((currentItems) => currentItems.map((item) => ({ ...item, read: true })));
    setActiveToasts([]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setActiveToasts((currentToasts) => currentToasts.filter((item) => item.id !== id));
  }, []);

  useRealtimeBusinessEvents({
    token,
    enabled: enabled && isHydrated,
    initialSinceTimestamp: lastReceivedAt,
    onLiveEvents: handleLiveEvents,
    onCatchupEvents: handleCatchupEvents,
    onStatusChange: setConnectionStatus,
    onCursorChange: setLastReceivedAt,
  });

  const value = useMemo<NotificationsContextValue>(
    () => ({
      items,
      unreadCount: items.filter((item) => !item.read).length,
      connectionStatus,
      activeToasts,
      markAsRead,
      markAllAsRead,
      dismissToast,
    }),
    [activeToasts, connectionStatus, dismissToast, items, markAllAsRead, markAsRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider.");
  }
  return context;
}

function loadPersistedNotifications(): PersistedNotificationsState {
  if (typeof window === "undefined") {
    return { items: [], lastReceivedAt: null };
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { items: [], lastReceivedAt: null };
    }

    const parsed = JSON.parse(raw) as PersistedNotificationsState;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      lastReceivedAt: typeof parsed.lastReceivedAt === "string" ? parsed.lastReceivedAt : null,
    };
  } catch {
    return { items: [], lastReceivedAt: null };
  }
}
