import { Suspense } from "react";
import StaffLoginPageClient from "./StaffLoginPageClient";

export const dynamic = "force-dynamic";

function StaffLoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7efe6] p-6">
      <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-sm">
        <p className="text-center text-sm text-[#6d5445]">
          Loading staff login...
        </p>
      </div>
    </main>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={<StaffLoginFallback />}>
      <StaffLoginPageClient />
    </Suspense>
  );
}
