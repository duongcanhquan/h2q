function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Progress({
  value = 0,
  className,
  indicatorClassName,
  label,
}: {
  value?: number;
  className?: string;
  indicatorClassName?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cx("space-y-1.5", className)}>
      {label ? (
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>{label}</span>
          <span className="font-semibold text-slate-800">{pct}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className={cx(
            "h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out",
            indicatorClassName,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
