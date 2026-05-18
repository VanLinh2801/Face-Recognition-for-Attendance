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
        "group relative inline-flex items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--background-elevated)_76%,transparent)] text-[var(--foreground)] shadow-[0_10px_24px_rgba(16,24,40,0.08)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(255,138,58,0.34)] hover:shadow-[0_14px_28px_rgba(255,106,46,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        compact ? "h-10 w-10" : "h-11 w-11",
      )}
      aria-label={`${t("theme.label")}: ${currentLabel}`}
      title={`${t("theme.label")}: ${currentLabel}`}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,176,83,0.2),rgba(255,106,46,0.14)_42%,transparent_72%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
      <span className="pointer-events-none absolute inset-[1px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0.04)_100%)] transition-opacity duration-300" />
      <span key={theme} className="control-orb-swap relative inline-flex items-center justify-center">
        <CurrentIcon className={cn("h-[18px] w-[18px]", isDark ? "text-[#ffd27a]" : "text-[var(--foreground-soft)]")} />
      </span>
    </button>
  );
}
