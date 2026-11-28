import { Suspense } from "react";
import LoginPageClient from "@/components/auth/LoginPageClient";
import { redirectAuthenticatedUser } from "@/lib/auth/redirect-authenticated-user";
import { AuthPageSkeleton } from "@/components/auth/AuthPageSkeleton";
import { customerReturnPath } from "@/lib/auth/customer-return-path";

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
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  await redirectAuthenticatedUser(customerReturnPath(next ?? null));

  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageClient />
    </Suspense>
  );
}
