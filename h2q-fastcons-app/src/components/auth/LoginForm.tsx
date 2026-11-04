"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HardHat, Loader2 } from "lucide-react";
import { login } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

function loginError(err: unknown) {
  if (err instanceof ApiError && err.message.trim()) return err.message;
  return "Đăng nhập thất bại. Thử lại.";
}

function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/dashboard";
  }
  return raw;
}

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
      router.replace(safeNext(search.get("next")));
    } catch (err) {
      setError(loginError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/30">
          <HardHat className="size-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">H2Q FastCons</h1>
        <p className="mt-2 text-base text-slate-600">Đăng nhập để ghi nhật ký hiện trường</p>
      </div>

      <form onSubmit={onSubmit} className="glass-card space-y-4 p-5">
        {error ? <ErrorBanner message={error} /> : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            className="field"
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
            className="field"
            autoComplete="current-password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            required
            placeholder="••••••••"
          />
        </label>

        <button type="submit" disabled={loading} className="btn btn-primary w-full min-h-14 text-base">
          {loading ? <Loader2 className="size-5 animate-spin" /> : null}
          {loading ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
