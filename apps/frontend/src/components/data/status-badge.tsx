import { Badge } from "@/components/ui/badge";
import type { RegistrationStatus, ReviewStatus, Severity, Status } from "@/lib/types";

export function PersonStatusBadge({ status }: { status: Status }) {
  const variant = status === "active" ? "success" : status === "inactive" ? "warning" : "default";
  return <Badge variant={variant}>{status}</Badge>;
}

export function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  const variant = status === "indexed" ? "success" : status === "failed" ? "danger" : status === "pending" ? "warning" : "info";
  return <Badge variant={variant}>{status}</Badge>;
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const variant = status === "new" ? "warning" : status === "reviewed" ? "success" : "default";
  return <Badge variant={variant}>{status}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const variant = severity === "high" ? "danger" : severity === "medium" ? "warning" : "info";
  return <Badge variant={variant}>{severity}</Badge>;
}

export function DirectionBadge({ direction }: { direction: "entry" | "exit" }) {
  return <Badge variant={direction === "entry" ? "success" : "info"}>{direction}</Badge>;
}
