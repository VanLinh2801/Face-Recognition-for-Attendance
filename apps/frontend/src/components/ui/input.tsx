import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, value, onChange, onCompositionStart, onCompositionEnd, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const isControlled = value !== undefined;
  const [localValue, setLocalValue] = React.useState(value);
  const composingRef = React.useRef(false);

  React.useEffect(() => {
    if (!composingRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (isControlled) {
      setLocalValue(event.target.value);
    }

    if (!composingRef.current) {
      onChange?.(event);
    }
  }

  function handleCompositionStart(event: React.CompositionEvent<HTMLInputElement>) {
    composingRef.current = true;
    onCompositionStart?.(event);
  }

  function handleCompositionEnd(event: React.CompositionEvent<HTMLInputElement>) {
    composingRef.current = false;
    if (isControlled) {
      setLocalValue(event.currentTarget.value);
      onChange?.({
        ...event,
        currentTarget: event.currentTarget,
        target: event.currentTarget,
      } as React.ChangeEvent<HTMLInputElement>);
    }
    onCompositionEnd?.(event);
  }

  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background-elevated)] px-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]",
        className,
      )}
      value={isControlled ? localValue : value}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background-elevated)] px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, value, onChange, onCompositionStart, onCompositionEnd, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const isControlled = value !== undefined;
  const [localValue, setLocalValue] = React.useState(value);
  const composingRef = React.useRef(false);

  React.useEffect(() => {
    if (!composingRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (isControlled) {
      setLocalValue(event.target.value);
    }

    if (!composingRef.current) {
      onChange?.(event);
    }
  }

  function handleCompositionStart(event: React.CompositionEvent<HTMLTextAreaElement>) {
    composingRef.current = true;
    onCompositionStart?.(event);
  }

  function handleCompositionEnd(event: React.CompositionEvent<HTMLTextAreaElement>) {
    composingRef.current = false;
    if (isControlled) {
      setLocalValue(event.currentTarget.value);
      onChange?.({
        ...event,
        currentTarget: event.currentTarget,
        target: event.currentTarget,
      } as React.ChangeEvent<HTMLTextAreaElement>);
    }
    onCompositionEnd?.(event);
  }

  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]",
        className,
      )}
      value={isControlled ? localValue : value}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      {...props}
    />
  );
}
