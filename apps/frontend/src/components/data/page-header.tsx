import { useEffect } from "react";
import { usePageHeaderContext } from "@/components/layout/page-header-context";

export function PageHeader({
  title,
  description,
  action,
  actionHref,
  actionOnClick,
}: {
  title: string;
  description?: string;
  action?: string;
  actionHref?: string;
  actionOnClick?: () => void;
}) {
  const { setHeader } = usePageHeaderContext();

  void action;
  void actionHref;
  void actionOnClick;

  useEffect(() => {
    setHeader({ title, description });
    return () => setHeader(null);
  }, [description, setHeader, title]);

  return null;
}
