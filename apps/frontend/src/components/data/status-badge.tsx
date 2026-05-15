import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { RegistrationStatus, ReviewStatus, Severity, Status } from "@/lib/types";

export function PersonStatusBadge({ status }: { status: Status }) {
  const t = useTranslations("common.status");
  const variant = status === "active" ? "success" : status === "inactive" ? "warning" : "default";
  return <Badge variant={variant}>{t(status)}</Badge>;
}

export function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  const t = useTranslations("common.status");
  const variant = status === "indexed" ? "success" : status === "failed" ? "danger" : status === "pending" ? "warning" : "info";
  return <Badge variant={variant}>{t(status)}</Badge>;
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const t = useTranslations("common.status");
  const variant = status === "new" ? "warning" : status === "reviewed" ? "success" : "default";
  return <Badge variant={variant}>{t(status)}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const t = useTranslations("common.status");
  const variant = severity === "high" ? "danger" : severity === "medium" ? "warning" : "info";
  return <Badge variant={variant}>{t(severity)}</Badge>;
}

export function DirectionBadge({ direction }: { direction: "entry" | "exit" | "unknown" }) {
  const t = useTranslations("common.status");
  const variant = direction === "entry" ? "success" : direction === "exit" ? "info" : "warning";
  return <Badge variant={variant}>{t(direction)}</Badge>;
}
