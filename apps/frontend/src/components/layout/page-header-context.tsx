"use client";

import { createContext, useContext } from "react";

export type PageHeaderState = {
  title: string;
  description?: string;
};

type PageHeaderContextValue = {
  setHeader: (header: PageHeaderState | null) => void;
};

export const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function usePageHeaderContext() {
  const context = useContext(PageHeaderContext);
  if (!context) {
    throw new Error("usePageHeaderContext must be used within AppShell.");
  }
  return context;
}
