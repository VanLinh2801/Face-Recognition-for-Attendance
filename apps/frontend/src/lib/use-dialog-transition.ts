"use client";

import { useEffect, useState } from "react";

const DIALOG_TRANSITION_MS = 320;

export function useDialogTransition<T>(value: T | null | false) {
  const [renderedValue, setRenderedValue] = useState<T | null>(value || null);
  const [visible, setVisible] = useState(Boolean(value));

  useEffect(() => {
    if (value) {
      const frame = window.requestAnimationFrame(() => {
        setRenderedValue(value);
        setVisible(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const frame = window.requestAnimationFrame(() => setVisible(false));
    const timer = window.setTimeout(() => setRenderedValue(null), DIALOG_TRANSITION_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [value]);

  return {
    value: renderedValue,
    visible,
  };
}

export function dialogOverlayClass(visible: boolean) {
  return `transition-opacity duration-300 ease-out ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`;
}

export function dialogPanelClass(visible: boolean) {
  return `transition-all duration-300 ease-out ${visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0"}`;
}
