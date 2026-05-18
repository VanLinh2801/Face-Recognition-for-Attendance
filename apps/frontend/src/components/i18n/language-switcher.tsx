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
        "group relative inline-flex items-center justify-center overflow-hidden rounded-full border border-[var(--toolbar-orb-border)] bg-[var(--toolbar-orb-bg)] text-[var(--toolbar-orb-foreground)] shadow-[var(--toolbar-orb-shadow)] backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--toolbar-orb-hover-border)] hover:shadow-[var(--toolbar-orb-hover-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-wait disabled:hover:translate-y-0",
        compact ? "h-10 w-10" : "h-11 w-11",
        isTransitioning && "border-[var(--toolbar-orb-active-border)] shadow-[var(--toolbar-orb-active-shadow)]",
      )}
      aria-label={`${t("language.label")}: ${t(`language.${locale}`)}`}
      title={`${t("language.label")}: ${t(`language.${locale}`)}`}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[var(--toolbar-orb-overlay)] opacity-80 transition-opacity duration-200 group-hover:opacity-100" />
      <span className="pointer-events-none absolute inset-[1px] rounded-full bg-[var(--toolbar-orb-inner)]" />
      <span
        key={locale}
        className={cn(
          "relative flex flex-col items-center justify-center leading-none",
          isTransitioning ? "control-orb-pulse" : "control-orb-swap",
        )}
      >
        <Languages className="mb-0.5 h-3.5 w-3.5 text-[var(--toolbar-language-icon)]" />
        <span className="text-[10px] font-semibold tracking-[0.12em] text-[var(--toolbar-language-text)]">{localeShortLabel[locale]}</span>
      </span>
    </button>
  );
}
