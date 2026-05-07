"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Database,
  LayoutDashboard,
  Radio,
  UserRound,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  const pathname = usePathname();

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
          <div className={cn("flex items-center gap-3 rounded-md bg-slate-50 p-2", collapsed && "justify-center")}>
            <UserRound className="h-5 w-5 text-slate-500" />
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">admin</div>
                <div className="truncate text-xs text-slate-500">Local mock session</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className={cn("min-h-screen transition-all duration-200", collapsed ? "pl-[72px]" : "pl-64")}>
        {children}
      </main>
    </div>
  );
}
