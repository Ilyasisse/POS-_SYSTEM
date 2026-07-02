import { Suspense } from "react";
import LoginPageClient from "@/components/auth/LoginPageClient";
import { redirectAuthenticatedUser } from "@/lib/auth/redirect-authenticated-user";
import { AuthPageSkeleton } from "@/components/auth/AuthPageSkeleton";

export const dynamic = "force-dynamic";

function LoginFallback() {
  return <AuthPageSkeleton />;
}

/**
 * Renders the customer login route with a suspense fallback.
 *
 * @returns The rendered login route.
 *
 * @remarks Uses the reusable LoginPageClient component from src/components/auth.
 */
export default async function LoginPage() {
  await redirectAuthenticatedUser();

  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageClient />
    </Suspense>
  );
}
