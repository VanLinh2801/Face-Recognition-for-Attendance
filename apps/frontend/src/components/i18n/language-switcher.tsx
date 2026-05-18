"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useLocaleTransition } from "@/components/i18n/locale-transition-provider";
import { type AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const nextLocaleMap: Record<AppLocale, AppLocale> = {
  vi: "en",
  en: "vi",
};

const localeShortLabel: Record<AppLocale, string> = {
  vi: "VI",
  en: "EN",
};

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations();
  const { changeLocale, isTransitioning } = useLocaleTransition();
  const nextLocale = nextLocaleMap[locale];

  return (
    <button
      type="button"
      onClick={() => void changeLocale(nextLocale)}
      disabled={isTransitioning}
      className={cn(
        "group relative inline-flex items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--background-elevated)_76%,transparent)] text-[var(--foreground)] shadow-[0_10px_24px_rgba(16,24,40,0.08)] backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(255,138,58,0.34)] hover:shadow-[0_14px_28px_rgba(255,106,46,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-wait disabled:hover:translate-y-0",
        compact ? "h-10 w-10" : "h-11 w-11",
        isTransitioning && "border-[rgba(255,138,58,0.34)] shadow-[0_0_0_1px_rgba(255,138,58,0.18),0_14px_28px_rgba(255,106,46,0.18)]",
      )}
      aria-label={`${t("language.label")}: ${t(`language.${locale}`)}`}
      title={`${t("language.label")}: ${t(`language.${locale}`)}`}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,176,83,0.22),rgba(255,106,46,0.14)_42%,transparent_72%)] opacity-80 transition-opacity duration-200 group-hover:opacity-100" />
      <span className="pointer-events-none absolute inset-[1px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0.04)_100%)]" />
      <span
        key={locale}
        className={cn(
          "relative flex flex-col items-center justify-center leading-none",
          isTransitioning ? "control-orb-pulse" : "control-orb-swap",
        )}
      >
        <Languages className="mb-0.5 h-3.5 w-3.5 text-[var(--foreground-soft)]" />
        <span className="text-[10px] font-semibold tracking-[0.12em]">{localeShortLabel[locale]}</span>
      </span>
    </button>
  );
}
