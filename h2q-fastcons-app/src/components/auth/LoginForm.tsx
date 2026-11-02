"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HardHat, Loader2 } from "lucide-react";
import { login } from "@/lib/frappe/client";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FrappeApiError } from "@/lib/frappe/errors";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [usr, setUsr] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(usr.trim(), pwd);
      const next = search.get("next") || "/dashboard";
      router.replace(next.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      const message =
        err instanceof FrappeApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Đăng nhập thất bại";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/30">
          <HardHat className="size-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">H2Q FastCons</h1>
        <p className="mt-2 text-base text-slate-600">Đăng nhập để ghi nhật ký hiện trường</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
      >
        {error ? <ErrorBanner message={error} /> : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Tài khoản Frappe</span>
          <input
            className="min-h-14 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 text-base outline-none ring-amber-500 focus:border-amber-500 focus:ring-2"
            autoComplete="username"
            inputMode="email"
            value={usr}
            onChange={(e) => setUsr(e.target.value)}
            required
            placeholder="user@h2q.com.vn"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Mật khẩu</span>
          <input
            type="password"
            className="min-h-14 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 text-base outline-none ring-amber-500 focus:border-amber-500 focus:ring-2"
            autoComplete="current-password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            required
            placeholder="••••••••"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-base font-semibold text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : null}
          {loading ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
