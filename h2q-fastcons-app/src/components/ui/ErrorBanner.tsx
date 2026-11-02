import { AlertTriangle } from "lucide-react";

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="leading-snug">{message}</p>
    </div>
  );
}
