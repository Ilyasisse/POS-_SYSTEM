import { Suspense } from "react";
import StaffLoginPageClient from "@/components/auth/StaffLoginPageClient";
import { redirectAuthenticatedUser } from "@/lib/auth/redirect-authenticated-user";
import { AuthPageSkeleton } from "@/components/auth/AuthPageSkeleton";

export const dynamic = "force-dynamic";

function StaffLoginFallback() {
  return <AuthPageSkeleton />;
}

export default async function StaffLoginPage() {
  await redirectAuthenticatedUser();

  return (
    <Suspense fallback={<StaffLoginFallback />}>
      <StaffLoginPageClient />
    </Suspense>
  );
}
