"use client";

import { Bell, CheckCheck, ShieldAlert, Wifi, WifiOff, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/components/notifications/notifications-provider";
import { buildNotificationHref } from "@/lib/realtime-notifications";
import type {
  NotificationItem,
  RealtimeSpoofDetectedEvent,
  RealtimeUnknownDetectedEvent,
  WebSocketConnectionStatus,
} from "@/lib/types";
import { useOutsideClick } from "@/lib/use-outside-click";

export function NotificationCenter() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { items, unreadCount, connectionStatus, markAsRead, markAllAsRead } = useNotifications();

  useOutsideClick(containerRef, open, () => setOpen(false));

  function handleOpenNotification(item: NotificationItem) {
    markAsRead(item.id);
    setOpen(false);
    router.push(buildNotificationHref(item));
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative h-10 w-10 rounded-full"
        onClick={() => setOpen((current) => !current)}
        aria-label={t("notifications.open")}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>
      <StatusIndicator status={connectionStatus} />

      {open ? (
        <div className="absolute right-0 top-12 z-[95] w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">{t("notifications.title")}</div>
              <div className="mt-1 text-xs text-slate-500">{getConnectionLabel(connectionStatus, t)}</div>
            </div>
            <Button variant="ghost" size="sm" disabled={unreadCount === 0} onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4" />
              {t("notifications.markAllAsRead")}
            </Button>
          </div>

          <div className="thin-scrollbar max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">{t("notifications.empty")}</div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenNotification(item)}
                  className={item.read ? notificationRowClass : `${notificationRowClass} bg-slate-50/70`}
                >
                  <div className="flex items-start gap-3">
                    <div className={item.kind === "spoof" ? iconDangerClass : iconWarningClass}>
                      {item.kind === "spoof" ? <ShieldAlert className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={item.kind === "spoof" ? "danger" : "warning"}>
                            {item.kind === "spoof" ? t("notifications.kind.spoof") : t("notifications.kind.unknown")}
                          </Badge>
                          {!item.read ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : null}
                        </div>
                        <span className="text-[11px] text-slate-400">{formatNotificationDateTime(item.occurredAt, locale)}</span>
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-950">{getNotificationTitle(item, t)}</div>
                      <div className="mt-1 truncate text-sm text-slate-600">{getNotificationMessage(item, t)}</div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        {item.severity ? <span>{formatSeverity(item.severity, t)}</span> : null}
                        {item.score != null ? <span>{formatPercent(item.score, t("common.unknown"))}</span> : null}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function NotificationToastsLayer() {
  const router = useRouter();
  const { activeToasts, dismissToast, markAsRead } = useNotifications();

  function handleOpenNotification(item: NotificationItem) {
    markAsRead(item.id);
    router.push(buildNotificationHref(item));
  }

  return <NotificationToasts items={activeToasts} onOpen={handleOpenNotification} onDismiss={dismissToast} />;
}

function NotificationToasts({
  items,
  onOpen,
  onDismiss,
}: {
  items: NotificationItem[];
  onOpen: (item: NotificationItem) => void;
  onDismiss: (id: string) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [hiddenToastIds, setHiddenToastIds] = useState<string[]>([]);

  function closeToast(id: string) {
    setHiddenToastIds((current) => (current.includes(id) ? current : [...current, id]));
    window.setTimeout(() => {
      setHiddenToastIds((current) => current.filter((value) => value !== id));
      onDismiss(id);
    }, 300);
  }

  useEffect(() => {
    if (items.length === 0) return;

    const timers = items.flatMap((item) => {
      const hideTimer = window.setTimeout(() => {
        setHiddenToastIds((current) => (current.includes(item.id) ? current : [...current, item.id]));
      }, 3500);
      const removeTimer = window.setTimeout(() => {
        setHiddenToastIds((current) => current.filter((id) => id !== item.id));
        onDismiss(item.id);
      }, 3850);
      return [hideTimer, removeTimer];
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [items, onDismiss]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[98] w-[360px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] sm:bottom-5 sm:right-5">
      <div className="thin-scrollbar flex max-h-full flex-col gap-3 overflow-y-auto pr-1">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto rounded-lg border bg-white p-4 text-sm shadow-2xl transition-all duration-300 ease-out ${
              hiddenToastIds.includes(item.id) ? "translate-x-[calc(100%+2rem)] opacity-0" : "translate-x-0 opacity-100"
            } ${
              item.kind === "spoof" ? "border-red-200" : "border-amber-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={item.kind === "spoof" ? dangerDotClass : warningDotClass} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-950">{getNotificationTitle(item, t)}</div>
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="mt-1 block w-full text-left text-sm font-normal text-slate-600"
                >
                  {buildToastDescription(item, t, locale)}
                </button>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  closeToast(item.id);
                }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                aria-label={t("notifications.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIndicator({ status }: { status: WebSocketConnectionStatus }) {
  const connected = status === "connected";

  return (
    <div className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-white bg-white shadow-sm">
      {connected ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5 text-slate-400" />}
    </div>
  );
}

function getConnectionLabel(status: WebSocketConnectionStatus, t: ReturnType<typeof useTranslations>) {
  if (status === "connected") return t("notifications.connection.connected");
  if (status === "connecting") return t("notifications.connection.connecting");
  if (status === "error") return t("notifications.connection.error");
  return t("notifications.connection.disconnected");
}

const notificationRowClass =
  "w-full border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 last:border-b-0";

const iconDangerClass = "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600";
const iconWarningClass = "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600";
const dangerDotClass = "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500";
const warningDotClass = "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500";

function getNotificationTitle(item: NotificationItem, t: ReturnType<typeof useTranslations>) {
  if (item.kind === "unknown") {
    return t("notifications.item.unknownTitle");
  }
  return t("notifications.item.spoofTitle");
}

function getNotificationMessage(item: NotificationItem, t: ReturnType<typeof useTranslations>) {
  if (item.sourceEvent.event_type === "unknown_event.detected") {
    return getUnknownNotificationMessage(item.sourceEvent, t);
  }
  if (item.sourceEvent.event_type === "spoof_alert.detected") {
    return getSpoofNotificationMessage(item.sourceEvent, t);
  }
  return item.message;
}

function getUnknownNotificationMessage(event: RealtimeUnknownDetectedEvent, t: ReturnType<typeof useTranslations>) {
  const parts = [
    event.payload.track_id
      ? t("notifications.item.track", { id: event.payload.track_id })
      : t("notifications.item.cameraEvent"),
    event.payload.event_source,
  ];
  return parts.filter(Boolean).join(" · ");
}

function getSpoofNotificationMessage(event: RealtimeSpoofDetectedEvent, t: ReturnType<typeof useTranslations>) {
  const parts = [event.payload.person_name ?? t("notifications.item.cameraEvent"), event.payload.event_source];
  return parts.filter(Boolean).join(" · ");
}

function buildToastDescription(item: NotificationItem, t: ReturnType<typeof useTranslations>, locale: string) {
  const parts = [getNotificationMessage(item, t)];

  if (item.severity) {
    parts.push(formatSeverity(item.severity, t));
  }

  if (item.score != null) {
    parts.push(formatPercent(item.score, t("common.unknown")));
  }

  parts.push(formatNotificationDateTime(item.occurredAt, locale));

  return parts.filter(Boolean).join(" · ");
}

function formatSeverity(value: string, t: ReturnType<typeof useTranslations>) {
  if (t.has(`common.status.${value}`)) {
    return t(`common.status.${value}`);
  }
  return value;
}

function formatPercent(value: number | null | undefined, emptyLabel: string) {
  if (value == null) return emptyLabel;
  return `${Math.round(value * 100)}%`;
}

function formatNotificationDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
