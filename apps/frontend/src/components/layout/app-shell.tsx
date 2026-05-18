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
  Fingerprint,
  KeyRound,
  LogOut,
  Radio,
  ScanSearch,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { NotificationCenter, NotificationToastsLayer } from "@/components/notifications/notification-center";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeaderContext, type PageHeaderState } from "@/components/layout/page-header-context";
import { apiFetch, SESSION_EXPIRED_EVENT } from "@/lib/api-client";
import { clearAuthTokens, getRefreshToken } from "@/lib/auth-client";
import { getTranslatedBackendError } from "@/lib/translated-backend-error";
import type { CurrentUser } from "@/lib/types";
import { dialogOverlayClass, dialogPanelClass, useDialogTransition } from "@/lib/use-dialog-transition";
import { useOutsideClick } from "@/lib/use-outside-click";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", labelKey: "navigation.dashboard", icon: ScanSearch },
  { href: "/persons", labelKey: "navigation.persons", icon: Users },
  { href: "/attendance", labelKey: "navigation.attendance", icon: CalendarClock },
  { href: "/events", labelKey: "navigation.events", icon: Radio },
  { href: "/departments", labelKey: "navigation.departments", icon: Building2 },
];

const SIDEBAR_EXPANDED_WIDTH = "w-[280px]";
const SIDEBAR_COLLAPSED_WIDTH = "w-[88px]";
const MAIN_EXPANDED_PADDING = "pl-[280px]";
const MAIN_COLLAPSED_PADDING = "pl-[88px]";

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
  const [pageHeader, setPageHeader] = useState<PageHeaderState | null>(null);
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

  useEffect(() => {
    if (pathname === "/login") return;
    setPageHeader(getFallbackHeader(pathname, t));
  }, [pathname, t]);

  if (pathname === "/login") {
    return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">{children}</div>;
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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside
        className={cn(
          "app-shell-sidebar",
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] transition-all duration-300",
          "before:pointer-events-none before:absolute before:left-6 before:right-6 before:top-[92px] before:h-px before:bg-[var(--sidebar-divider)]",
          "after:pointer-events-none after:absolute after:left-8 after:top-20 after:h-14 after:w-28 after:rounded-full after:bg-[var(--sidebar-brand-glow)] after:blur-3xl",
          collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
        )}
      >
        <div className={cn("relative px-4 pb-6 pt-6", collapsed ? "px-3" : "px-5")}>
          <div className={cn("flex items-start gap-3", collapsed ? "justify-center" : "justify-between")}>
            <Link href="/" className={cn("flex min-w-0 items-center gap-3", collapsed && "justify-center")}>
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[var(--sidebar-brand-surface)] text-[var(--primary)] shadow-[var(--sidebar-brand-shadow)] ring-1 ring-white/10">
                <Fingerprint className="h-7 w-7" strokeWidth={2.2} />
              </div>
              {!collapsed && (
                <div className="min-w-0 pt-0.5">
                  <div className="truncate text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--sidebar-foreground)]">
                    {t("layout.appName")}
                  </div>
                  <div className="truncate text-sm text-[var(--sidebar-foreground-soft)]">{t("layout.appSubtitle")}</div>
                </div>
              )}
            </Link>
            {!collapsed ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={t("layout.toggleSidebar")}
                className="mt-1 h-9 w-9 rounded-full border border-[var(--sidebar-control-border)] bg-[var(--sidebar-control-bg)] text-[var(--sidebar-foreground-soft)] hover:border-[var(--sidebar-control-border-hover)] hover:bg-[var(--sidebar-control-hover)] hover:text-[var(--sidebar-foreground)]"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={t("layout.toggleSidebar")}
                className="absolute right-2 top-2 h-8 w-8 rounded-full border border-[var(--sidebar-control-border)] bg-[var(--sidebar-control-bg)] text-[var(--sidebar-foreground-soft)] hover:border-[var(--sidebar-control-border-hover)] hover:bg-[var(--sidebar-control-hover)] hover:text-[var(--sidebar-foreground)]"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <nav className={cn("thin-scrollbar relative flex-1 overflow-y-auto", collapsed ? "px-3 pb-4" : "px-4 pb-5")}>
          <div className="space-y-2">
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
                    "group relative flex items-center overflow-hidden rounded-2xl text-sm font-semibold transition-all duration-200",
                    collapsed ? "h-14 justify-center px-0" : "h-14 gap-3.5 px-4",
                    active
                      ? "border border-[var(--sidebar-item-active-border)] bg-[var(--sidebar-item-active-bg)] text-[var(--sidebar-item-active-foreground)] shadow-[var(--sidebar-item-active-shadow)]"
                      : "text-[var(--sidebar-foreground-soft)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-foreground)]",
                  )}
                >
                  {active ? (
                    <>
                      <span className="pointer-events-none absolute inset-y-[3px] left-[3px] right-[3px] rounded-[13px] ring-1 ring-[var(--sidebar-item-active-border-inner)]" />
                      <span className="pointer-events-none absolute -right-6 top-1/2 h-14 w-12 -translate-y-1/2 rounded-full bg-[var(--sidebar-item-active-glow)] blur-2xl" />
                    </>
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors duration-200",
                      active
                        ? "bg-[var(--sidebar-item-active-icon-bg)] text-[var(--sidebar-item-active-foreground)]"
                        : "text-[var(--sidebar-icon-muted)] group-hover:text-[var(--sidebar-foreground)]",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  {!collapsed && <span className="relative z-10 truncate">{label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className={cn("relative border-t border-[var(--sidebar-divider-strong)]", collapsed ? "p-3" : "p-4")}>
          <div ref={accountMenuRef} className="relative">
            {accountMenuOpen ? (
              <div
                className={cn(
                  "absolute bottom-[calc(100%+12px)] z-40 overflow-hidden rounded-2xl border border-[var(--sidebar-border)] bg-[var(--sidebar-profile-menu-bg)] p-1.5 shadow-[var(--shadow-md)] backdrop-blur-xl",
                  collapsed ? "left-0 w-56" : "left-0 right-0",
                )}
              >
                <button
                  type="button"
                  onClick={openChangePasswordDialog}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--sidebar-foreground-soft)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-foreground)]"
                >
                  <KeyRound className="h-4 w-4" />
                  {t("layout.changePassword")}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:cursor-wait disabled:opacity-60"
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
                "w-full rounded-2xl border border-[var(--sidebar-profile-border)] bg-[var(--sidebar-profile-bg)] text-left shadow-[var(--sidebar-profile-shadow)] transition-all duration-200 hover:border-[var(--sidebar-profile-border-hover)] hover:bg-[var(--sidebar-profile-hover)]",
                collapsed ? "flex justify-center p-3" : "flex items-center gap-3 px-3 py-3.5",
              )}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--sidebar-avatar-bg)] text-[var(--sidebar-avatar-foreground)] ring-1 ring-[var(--sidebar-avatar-ring)]">
                <UserRound className="h-6 w-6" />
              </span>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-[var(--sidebar-foreground)]">{accountUsername}</div>
                    <div className="truncate text-sm text-[var(--sidebar-foreground-soft)]">{t("layout.adminSession")}</div>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-[var(--sidebar-foreground-muted)] transition-transform",
                      accountMenuOpen && "-rotate-90",
                    )}
                  />
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      <PageHeaderContext.Provider value={{ setHeader: setPageHeader }}>
        <main className={cn("min-h-screen transition-all duration-300", collapsed ? MAIN_COLLAPSED_PADDING : MAIN_EXPANDED_PADDING)}>
          <div className="app-shell-topbar sticky top-0 z-20 flex min-h-20 items-center gap-4 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background-panel)_76%,transparent)] px-6 py-4 backdrop-blur-xl">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[1.45rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                {pageHeader?.title ?? t("layout.appName")}
              </div>
              {pageHeader?.description ? (
                <div className="mt-1 truncate text-sm text-[var(--foreground-soft)]">{pageHeader.description}</div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-3">
              <ThemeSwitcher compact />
              <LanguageSwitcher compact />
              <NotificationCenter />
            </div>
          </div>
          {children}
        </main>
      </PageHeaderContext.Provider>

      <NotificationToastsLayer />

      {visibleSessionExpiredMessage ? (
        <div
          className={`fixed inset-0 z-[120] grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm ${dialogOverlayClass(sessionExpiredDialog.visible)}`}
        >
          <div className={`w-full max-w-md overflow-hidden rounded-lg bg-[var(--background-elevated)] shadow-[var(--shadow-md)] ${dialogPanelClass(sessionExpiredDialog.visible)}`}>
            <div className="border-b border-[var(--border)] p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--warning-soft)] text-[var(--warning)]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t("layout.sessionExpiredTitle")}</h2>
                  <p className="mt-2 text-sm text-[var(--foreground-soft)]">{visibleSessionExpiredMessage}</p>
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
          className={`fixed inset-0 z-[120] grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm ${dialogOverlayClass(changePasswordDialog.visible)}`}
          onMouseDown={closeChangePasswordDialog}
        >
          <div
            className={`w-full max-w-md overflow-hidden rounded-lg bg-[var(--background-elevated)] shadow-[var(--shadow-md)] ${dialogPanelClass(changePasswordDialog.visible)}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[var(--border)] p-5">
              <h2 className="text-lg font-semibold">{t("layout.changePassword")}</h2>
              <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                {t("layout.changePasswordDescription")}
              </p>
            </div>
            <form className="space-y-4 p-5" autoComplete="off">
              <input type="text" name="account_name" autoComplete="username" className="hidden" tabIndex={-1} />
              <input type="password" name="account_password" autoComplete="new-password" className="hidden" tabIndex={-1} />
              <label className="block space-y-2">
                <span className="text-sm font-medium">{t("layout.currentPassword")}</span>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="pr-10"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    name="current_password_input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((value) => !value)}
                    className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[var(--foreground-soft)] hover:bg-[var(--background-muted)] hover:text-[var(--foreground)]"
                    aria-label={showCurrentPassword ? t("layout.hideCurrentPassword") : t("layout.showCurrentPassword")}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">{t("layout.newPassword")}</span>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="pr-10"
                    autoComplete="new-password"
                    name="new_password_input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((value) => !value)}
                    className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[var(--foreground-soft)] hover:bg-[var(--background-muted)] hover:text-[var(--foreground)]"
                    aria-label={showNewPassword ? t("layout.hideNewPassword") : t("layout.showNewPassword")}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">{t("layout.confirmNewPassword")}</span>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="pr-10"
                    autoComplete="new-password"
                    name="confirm_new_password_input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[var(--foreground-soft)] hover:bg-[var(--background-muted)] hover:text-[var(--foreground)]"
                    aria-label={showConfirmPassword ? t("layout.hidePasswordConfirmation") : t("layout.showPasswordConfirmation")}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              {changePasswordError ? (
                <div className="rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
                  {changePasswordError}
                </div>
              ) : null}
            </form>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] p-5">
              <Button type="button" variant="outline" onClick={closeChangePasswordDialog} disabled={submittingPasswordChange}>
                {t("common.cancel")}
              </Button>
              <Button className="ui-button-link ui-button-link-primary" type="button" onClick={handleChangePassword} disabled={submittingPasswordChange}>
                {submittingPasswordChange ? t("layout.updatingPassword") : t("layout.updatePassword")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getFallbackHeader(pathname: string, t: ReturnType<typeof useTranslations>): PageHeaderState {
  if (pathname === "/" || pathname === "/dashboard") {
    return {
      title: t("navigation.dashboard"),
    };
  }
  if (pathname === "/persons") {
    return {
      title: t("persons.page.title"),
      description: t("persons.page.description"),
    };
  }
  if (pathname === "/persons/new") {
    return {
      title: "Thêm nhân sự",
    };
  }
  if (pathname.startsWith("/persons/") && pathname.endsWith("/face-registrations/new")) {
    return {
      title: "Đăng ký khuôn mặt",
    };
  }
  if (pathname.startsWith("/persons/")) {
    return {
      title: "Chi tiết nhân sự",
    };
  }
  if (pathname === "/attendance") {
    return {
      title: t("attendance.page.title"),
      description: t("attendance.page.description"),
    };
  }
  if (pathname === "/events") {
    return {
      title: t("events.page.title"),
      description: t("events.page.description"),
    };
  }
  if (pathname === "/departments") {
    return {
      title: t("departments.page.title"),
      description: t("departments.page.description"),
    };
  }
  if (pathname.startsWith("/departments/")) {
    return {
      title: t("departments.page.title"),
      description: t("departments.page.detailLoadingDescription"),
    };
  }
  return {
    title: t("layout.appName"),
    description: t("layout.appSubtitle"),
  };
}
