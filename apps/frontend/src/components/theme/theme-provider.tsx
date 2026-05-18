"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { THEME_STORAGE_KEY } from "@/components/theme/theme-constants";

export type ThemeMode = "light" | "dark";
const THEME_TRANSITIONING_CLASS = "theme-transitioning";
const THEME_TRANSITION_DURATION_MS = 280;

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

function runThemeTransition(nextTheme: ThemeMode) {
  const root = document.documentElement;
  const body = document.body;

  root.classList.add(THEME_TRANSITIONING_CLASS);
  body.classList.add(THEME_TRANSITIONING_CLASS);
  applyTheme(nextTheme);

  window.setTimeout(() => {
    root.classList.remove(THEME_TRANSITIONING_CLASS);
    body.classList.remove(THEME_TRANSITIONING_CLASS);
  }, THEME_TRANSITION_DURATION_MS);
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    readStoredTheme,
    (): ThemeMode => "light",
  );

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme(nextTheme) {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      runThemeTransition(nextTheme);
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    },
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
