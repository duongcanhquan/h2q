import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Spinner } from "@/components/ui/Spinner";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center gap-2 text-slate-600">
          <Spinner />
          Đang tải…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
