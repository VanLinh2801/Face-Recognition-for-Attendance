"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { THEME_STORAGE_KEY } from "@/components/theme/theme-constants";

export type ThemeMode = "light" | "dark";
const THEME_OVERLAY_FADE_IN_MS = 160;
const THEME_OVERLAY_FADE_OUT_MS = 240;

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_CHANGE_EVENT = "face-recognition-theme-change";

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";

  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === "dark" ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function subscribeTheme(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  function handleThemeChange() {
    onStoreChange();
  }

  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  window.addEventListener("storage", handleThemeChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleThemeChange);
  };
}

function readBackgroundColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--background").trim() || "#000000";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    readStoredTheme,
    (): ThemeMode => "light",
  );
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayOpaque, setOverlayOpaque] = useState(false);
  const [overlayColor, setOverlayColor] = useState("#000000");

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!overlayVisible) return;

    const frame = window.requestAnimationFrame(() => setOverlayOpaque(true));
    return () => window.cancelAnimationFrame(frame);
  }, [overlayVisible]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme(nextTheme) {
      if (nextTheme === theme) return;

      const coverColor = readBackgroundColor();
      setOverlayColor(coverColor);
      setOverlayOpaque(false);
      setOverlayVisible(true);

      window.setTimeout(() => {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        applyTheme(nextTheme);
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));

        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setOverlayColor(readBackgroundColor());
            setOverlayOpaque(false);

            window.setTimeout(() => {
              setOverlayVisible(false);
            }, THEME_OVERLAY_FADE_OUT_MS);
          });
        });
      }, THEME_OVERLAY_FADE_IN_MS);
    },
  }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {overlayVisible ? (
        <div
          aria-hidden="true"
          className={overlayOpaque ? "theme-transition-overlay theme-transition-overlay-visible" : "theme-transition-overlay"}
          style={{ backgroundColor: overlayColor, transitionDuration: `${overlayOpaque ? THEME_OVERLAY_FADE_IN_MS : THEME_OVERLAY_FADE_OUT_MS}ms` }}
        />
      ) : null}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
