import { Suspense } from "react";
import LoginPageClient from "@/components/auth/LoginPageClient";
import { redirectAuthenticatedUser } from "@/lib/auth/redirect-authenticated-user";
import { AuthPageSkeleton } from "@/components/auth/AuthPageSkeleton";

export const dynamic = "force-dynamic";

function LoginFallback() {
  return <AuthPageSkeleton />;
}

export default async function Page() {
  await redirectAuthenticatedUser();

  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageClient />
    </Suspense>
  );
}
