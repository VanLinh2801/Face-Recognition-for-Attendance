"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { localeCookieName, locales, type AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const t = useTranslations();

  async function changeLocale(nextLocale: AppLocale) {
    if (nextLocale === locale) return;
    localStorage.setItem(localeCookieName, nextLocale);
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: nextLocale }),
    });
    router.refresh();
  }

  return (
    <div className={cn("flex items-center gap-2", compact ? "justify-center" : "justify-between")}>
      {!compact ? (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
          <Languages className="h-4 w-4" />
          {t("language.label")}
        </span>
      ) : null}
      <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
        {locales.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => changeLocale(item)}
            className={cn(
              "h-7 rounded px-2 text-xs font-medium transition",
              item === locale ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
            )}
            aria-pressed={item === locale}
          >
            {t(`language.${item}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
