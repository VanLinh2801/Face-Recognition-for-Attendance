import { cn } from "@/lib/utils";

const variants = {
  default: "bg-[var(--background-muted)] text-[var(--foreground-soft)] ring-[var(--border)]",
  success: "bg-[var(--success-soft)] text-[var(--success)] ring-[var(--success)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)] ring-[var(--warning)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)] ring-[var(--danger)]",
  info: "bg-[var(--info-soft)] text-[var(--info)] ring-[var(--info)]",
  dark: "bg-[var(--foreground)] text-[var(--background-elevated)] ring-[var(--border-strong)]",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
