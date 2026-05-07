import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  action,
  actionHref,
}: {
  title: string;
  description: string;
  action?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action && actionHref ? (
        <a
          href={actionHref}
          className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          {action}
        </a>
      ) : action ? (
        <Button>{action}</Button>
      ) : null}
    </div>
  );
}
