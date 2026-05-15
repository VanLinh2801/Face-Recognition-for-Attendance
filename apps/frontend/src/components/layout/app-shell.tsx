"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Radio,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { NotificationCenter, NotificationToastsLayer } from "@/components/notifications/notification-center";
import { Button } from "@/components/ui/button";
import { apiFetch, SESSION_EXPIRED_EVENT } from "@/lib/api-client";
import { clearAuthTokens, getRefreshToken } from "@/lib/auth-client";
import { getTranslatedBackendError } from "@/lib/translated-backend-error";
import type { CurrentUser } from "@/lib/types";
import { dialogOverlayClass, dialogPanelClass, useDialogTransition } from "@/lib/use-dialog-transition";
import { useOutsideClick } from "@/lib/use-outside-click";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", labelKey: "navigation.dashboard", icon: LayoutDashboard },
  { href: "/persons", labelKey: "navigation.persons", icon: Users },
  { href: "/attendance", labelKey: "navigation.attendance", icon: CalendarClock },
  { href: "/events", labelKey: "navigation.events", icon: Radio },
  { href: "/departments", labelKey: "navigation.departments", icon: Building2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const [collapsed, setCollapsed] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const [accountUsername, setAccountUsername] = useState("admin");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");
  const [submittingPasswordChange, setSubmittingPasswordChange] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const sessionExpiredDialog = useDialogTransition(sessionExpiredMessage);
  const changePasswordDialog = useDialogTransition(changePasswordOpen);
  const visibleSessionExpiredMessage = sessionExpiredDialog.value;
  const visibleChangePasswordDialog = changePasswordDialog.value;

  useOutsideClick(accountMenuRef, accountMenuOpen, () => setAccountMenuOpen(false));

  useEffect(() => {
    function handleSessionExpired(event: Event) {
      const detail = (event as CustomEvent<{ code?: string; message?: string }>).detail;
      setSessionExpiredMessage(getTranslatedBackendError(
        t,
        {
          code: detail?.code ?? "session_expired",
          message: detail?.message,
          status: 401,
        },
        "auth",
      ));
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [t]);

  useEffect(() => {
    if (pathname === "/login") return;
    let active = true;

    async function loadCurrentUser() {
      try {
        const currentUser = await apiFetch<CurrentUser>("/auth/me", { withAuth: true });
        if (!active) return;
        setAccountUsername(currentUser.username);
      } catch {
        if (!active) return;
      }
    }

    void loadCurrentUser();
    return () => {
      active = false;
    };
  }, [pathname]);

  if (pathname === "/login") {
    return <div className="min-h-screen bg-slate-50 text-slate-950">{children}</div>;
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await apiFetch<{ status: string }>("/auth/logout", {
          method: "POST",
          withAuth: true,
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch {
      // Local cleanup still needs to happen if the token is invalid or the backend is unavailable.
    } finally {
      clearAuthTokens();
      setAccountMenuOpen(false);
      setLoggingOut(false);
      router.push("/login");
    }
  }

  function confirmSessionExpired() {
    clearAuthTokens();
    setSessionExpiredMessage(null);
    router.push("/login");
  }

  function openChangePasswordDialog() {
    setAccountMenuOpen(false);
    setChangePasswordError("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setChangePasswordOpen(true);
  }

  function closeChangePasswordDialog() {
    if (submittingPasswordChange) return;
    setChangePasswordOpen(false);
    setChangePasswordError("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }

  async function handleChangePassword() {
    if (submittingPasswordChange) return;

    const trimmedCurrentPassword = currentPassword.trim();
    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (!trimmedCurrentPassword || !trimmedNewPassword || !trimmedConfirmPassword) {
      setChangePasswordError(t("layout.passwordRequired"));
      return;
    }
    if (trimmedNewPassword.length < 8) {
      setChangePasswordError(t("errors.auth.newPasswordTooShort"));
      return;
    }
    if (trimmedCurrentPassword === trimmedNewPassword) {
      setChangePasswordError(t("errors.auth.newPasswordSameAsCurrent"));
      return;
    }
    if (trimmedNewPassword !== trimmedConfirmPassword) {
      setChangePasswordError(t("layout.passwordConfirmationMismatch"));
      return;
    }

    setSubmittingPasswordChange(true);
    setChangePasswordError("");

    try {
      await apiFetch<{ status: string }>("/auth/change-password", {
        method: "POST",
        withAuth: true,
        body: JSON.stringify({
          current_password: trimmedCurrentPassword,
          new_password: trimmedNewPassword,
        }),
      });
      clearAuthTokens();
      setChangePasswordOpen(false);
      router.push("/login");
    } catch (error) {
      setChangePasswordError(getTranslatedBackendError(t, error, "auth"));
    } finally {
      setSubmittingPasswordChange(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-200 bg-white transition-all duration-200",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-950 text-white">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{t("layout.appName")}</div>
                <div className="truncate text-xs text-slate-500">{t("layout.appSubtitle")}</div>
              </div>
            )}
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setCollapsed((value) => !value)} aria-label={t("layout.toggleSidebar")}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="thin-scrollbar flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            const label = t(item.labelKey);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                  active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div ref={accountMenuRef} className="relative">
            {accountMenuOpen ? (
              <div
                className={cn(
                  "absolute bottom-12 z-40 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl",
                  collapsed ? "left-0 w-56" : "left-0 right-0",
                )}
              >
                <button
                  type="button"
                  onClick={openChangePasswordDialog}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <KeyRound className="h-4 w-4" />
                  {t("layout.changePassword")}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOut ? t("layout.signingOut") : t("layout.signOut")}
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setAccountMenuOpen((value) => !value)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md bg-slate-50 p-2 text-left transition hover:bg-slate-100",
                collapsed && "justify-center",
              )}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
            >
              <UserRound className="h-5 w-5 text-slate-500" />
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{accountUsername}</div>
                    <div className="truncate text-xs text-slate-500">{t("layout.adminSession")}</div>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                      accountMenuOpen && "-rotate-90",
                    )}
                  />
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      <main className={cn("min-h-screen transition-all duration-200", collapsed ? "pl-[72px]" : "pl-64")}>
        <div className="sticky top-0 z-20 flex h-16 items-center justify-end gap-3 border-b border-slate-200 bg-slate-50/95 px-6 backdrop-blur">
          <LanguageSwitcher compact />
          <NotificationCenter />
        </div>
        {children}
      </main>

      <NotificationToastsLayer />

      {visibleSessionExpiredMessage ? (
        <div
          className={`fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm ${dialogOverlayClass(sessionExpiredDialog.visible)}`}
        >
          <div className={`w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl ${dialogPanelClass(sessionExpiredDialog.visible)}`}>
            <div className="border-b border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t("layout.sessionExpiredTitle")}</h2>
                  <p className="mt-2 text-sm text-slate-600">{visibleSessionExpiredMessage}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end p-5">
              <Button onClick={confirmSessionExpired}>OK</Button>
            </div>
          </div>
        </div>
      ) : null}

      {visibleChangePasswordDialog ? (
        <div
          className={`fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm ${dialogOverlayClass(changePasswordDialog.visible)}`}
          onMouseDown={closeChangePasswordDialog}
        >
          <div
            className={`w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl ${dialogPanelClass(changePasswordDialog.visible)}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-semibold">{t("layout.changePassword")}</h2>
              <p className="mt-2 text-sm text-slate-600">
                {t("layout.changePasswordDescription")}
              </p>
            </div>
            <form className="space-y-4 p-5" autoComplete="off">
              <input type="text" name="account_name" autoComplete="username" className="hidden" tabIndex={-1} />
              <input type="password" name="account_password" autoComplete="new-password" className="hidden" tabIndex={-1} />
              <label className="block space-y-2">
                <span className="text-sm font-medium">{t("layout.currentPassword")}</span>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 pr-10 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    name="current_password_input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((value) => !value)}
                    className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    aria-label={showCurrentPassword ? t("layout.hideCurrentPassword") : t("layout.showCurrentPassword")}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">{t("layout.newPassword")}</span>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 pr-10 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    autoComplete="new-password"
                    name="new_password_input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((value) => !value)}
                    className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    aria-label={showNewPassword ? t("layout.hideNewPassword") : t("layout.showNewPassword")}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">{t("layout.confirmNewPassword")}</span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 pr-10 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    autoComplete="new-password"
                    name="confirm_new_password_input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    aria-label={showConfirmPassword ? t("layout.hidePasswordConfirmation") : t("layout.showPasswordConfirmation")}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              {changePasswordError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {changePasswordError}
                </div>
              ) : null}
            </form>
            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
              <Button type="button" variant="outline" onClick={closeChangePasswordDialog} disabled={submittingPasswordChange}>
                {t("common.cancel")}
              </Button>
              <Button type="button" onClick={handleChangePassword} disabled={submittingPasswordChange}>
                {submittingPasswordChange ? t("layout.updatingPassword") : t("layout.updatePassword")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
