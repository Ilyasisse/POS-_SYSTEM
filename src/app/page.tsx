import { Suspense } from "react";
import LoginPageClient from "@/components/auth/LoginPageClient";

export const dynamic = "force-dynamic";

function LoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-center text-sm text-slate-600">
          Loading login page...
        </p>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageClient />
    </Suspense>
  );
}
