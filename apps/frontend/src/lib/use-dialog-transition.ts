"use client";

import { useEffect, useState } from "react";

const DIALOG_TRANSITION_MS = 320;
const DIALOG_OPEN_CLASS = "face-recognition-dialog-open";
const DIALOG_CHANGE_EVENT = "face-recognition-dialog-change";

declare global {
  interface Window {
    __faceRecognitionDialogCount?: number;
  }
}

function updateDialogOpenState(nextCount: number) {
  if (typeof window === "undefined") return;
  window.__faceRecognitionDialogCount = Math.max(0, nextCount);
  document.body.classList.toggle(DIALOG_OPEN_CLASS, window.__faceRecognitionDialogCount > 0);
  window.dispatchEvent(new CustomEvent(DIALOG_CHANGE_EVENT, { detail: { count: window.__faceRecognitionDialogCount } }));
}

function incrementDialogOpenCount() {
  if (typeof window === "undefined") return;
  updateDialogOpenState((window.__faceRecognitionDialogCount ?? 0) + 1);
}

function decrementDialogOpenCount() {
  if (typeof window === "undefined") return;
  updateDialogOpenState((window.__faceRecognitionDialogCount ?? 0) - 1);
}

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

  useEffect(() => {
    if (!visible) return;

    incrementDialogOpenCount();
    return () => decrementDialogOpenCount();
  }, [visible]);

  return {
    value: renderedValue,
    visible,
  };
}

export function dialogOverlayClass(visible: boolean) {
  return `transition-opacity duration-300 ease-out ${visible ? "opacity-100 backdrop-blur-md" : "pointer-events-none opacity-0 backdrop-blur-none"}`;
}

export function dialogPanelClass(visible: boolean) {
  return `transition-all duration-300 ease-out ${visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0"}`;
}

export function subscribeDialogOpenState(onChange: (open: boolean) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = (event: Event) => {
    const detail = (event as CustomEvent<{ count?: number }>).detail;
    onChange((detail?.count ?? window.__faceRecognitionDialogCount ?? 0) > 0);
  };

  window.addEventListener(DIALOG_CHANGE_EVENT, handleChange);
  onChange((window.__faceRecognitionDialogCount ?? 0) > 0);

  return () => window.removeEventListener(DIALOG_CHANGE_EVENT, handleChange);
}
