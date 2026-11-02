import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
      {icon}
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      {description ? <p className="max-w-sm text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}
