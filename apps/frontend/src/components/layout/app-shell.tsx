"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Database,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Radio,
  UserRound,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { clearAuthTokens, getRefreshToken } from "@/lib/auth-client";
import { useOutsideClick } from "@/lib/use-outside-click";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/persons", label: "Nhân sự", icon: Users },
  { href: "/attendance", label: "Chấm công", icon: CalendarClock },
  { href: "/events", label: "Sự kiện", icon: Radio },
  { href: "/departments", label: "Phòng ban", icon: Building2 },
  { href: "/media-assets", label: "Media assets", icon: Database },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useOutsideClick(accountMenuRef, accountMenuOpen, () => setAccountMenuOpen(false));

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
      // Local session cleanup still needs to happen if the token is already invalid or the backend is unavailable.
    } finally {
      clearAuthTokens();
      setAccountMenuOpen(false);
      setLoggingOut(false);
      router.push("/login");
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
                <div className="truncate text-sm font-semibold">Face Recognition</div>
                <div className="truncate text-xs text-slate-500">Attendance Admin</div>
              </div>
            )}
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setCollapsed((value) => !value)} aria-label="Toggle sidebar">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="thin-scrollbar flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                  active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
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
                  disabled
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-400 disabled:cursor-not-allowed"
                >
                  <KeyRound className="h-4 w-4" />
                  Đổi thông tin đăng nhập
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
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
                    <div className="truncate text-sm font-medium">admin</div>
                    <div className="truncate text-xs text-slate-500">Admin session</div>
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
        {children}
      </main>
    </div>
  );
}
