"use client";

import { useLocale } from "next-intl";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { localeCookieName, type AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

type LocaleTransitionContextValue = {
  isTransitioning: boolean;
  changeLocale: (nextLocale: AppLocale) => Promise<void>;
};

const LocaleTransitionContext = createContext<LocaleTransitionContextValue | null>(null);

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function LocaleTransitionProvider({ children }: { children: ReactNode }) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const targetLocaleRef = useRef<AppLocale | null>(null);
  const releaseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (releaseTimerRef.current !== null) {
        window.clearTimeout(releaseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTransitioning || targetLocaleRef.current !== locale) return;

    releaseTimerRef.current = window.setTimeout(() => {
      setIsTransitioning(false);
      targetLocaleRef.current = null;
      releaseTimerRef.current = null;
    }, 220);
  }, [isTransitioning, locale]);

  async function changeLocale(nextLocale: AppLocale) {
    if (nextLocale === locale || isTransitioning) return;

    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }

    targetLocaleRef.current = nextLocale;
    setIsTransitioning(true);

    try {
      localStorage.setItem(localeCookieName, nextLocale);
      await wait(140);
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      router.refresh();
    } catch (error) {
      setIsTransitioning(false);
      targetLocaleRef.current = null;
      throw error;
    }
  }

  const value = useMemo<LocaleTransitionContextValue>(
    () => ({
      isTransitioning,
      changeLocale,
    }),
    [isTransitioning, locale],
  );

  return (
    <LocaleTransitionContext.Provider value={value}>
      <div className="relative min-h-screen">
        <div
          className={cn(
            "locale-transition-shell min-h-screen transition-[opacity,filter,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isTransitioning && "locale-transition-shell-active",
          )}
        >
          {children}
        </div>
        <div
          className={cn(
            "pointer-events-none fixed inset-0 z-[140] opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isTransitioning && "pointer-events-auto opacity-100",
          )}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--background)_84%,transparent)] backdrop-blur-[6px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,138,58,0.16),transparent_24%),radial-gradient(circle_at_22%_18%,rgba(217,32,39,0.08),transparent_20%)]" />
        </div>
      </div>
    </LocaleTransitionContext.Provider>
  );
}

export function useLocaleTransition() {
  const context = useContext(LocaleTransitionContext);

  if (!context) {
    throw new Error("useLocaleTransition must be used within a LocaleTransitionProvider");
  }

  return context;
}
