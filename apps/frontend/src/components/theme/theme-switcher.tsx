"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const CurrentIcon = isDark ? Moon : Sun;
  const currentLabel = t(`theme.${theme}`);

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "group relative inline-flex items-center justify-center overflow-hidden rounded-full border border-[var(--toolbar-orb-border)] bg-[var(--toolbar-orb-bg)] text-[var(--toolbar-orb-foreground)] shadow-[var(--toolbar-orb-shadow)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--toolbar-orb-hover-border)] hover:shadow-[var(--toolbar-orb-hover-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        compact ? "h-10 w-10" : "h-11 w-11",
      )}
      aria-label={`${t("theme.label")}: ${currentLabel}`}
      title={`${t("theme.label")}: ${currentLabel}`}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[var(--toolbar-orb-overlay)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
      <span className="pointer-events-none absolute inset-[1px] rounded-full bg-[var(--toolbar-orb-inner)] transition-opacity duration-300" />
      <span key={theme} className="control-orb-swap relative inline-flex items-center justify-center">
        <CurrentIcon className={cn("h-[18px] w-[18px]", isDark ? "text-[var(--toolbar-theme-icon)]" : "text-[var(--toolbar-sun-icon)]")} />
      </span>
    </button>
  );
}
