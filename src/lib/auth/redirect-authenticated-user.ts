import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { findAppUser } from "@/lib/auth/app-user";
import { getDefaultRouteForUser } from "@/lib/auth/get-default-route-for-user";
import type { CustomerReturnPath } from "@/lib/auth/customer-return-path";

export async function redirectAuthenticatedUser(next: CustomerReturnPath | null = null) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Keep login routes from rendering stale UI before /auth/redirect chooses the user's destination.
  if (!error && user) {
    const profile = await findAppUser(user.id);
    // An Auth session alone does not provide an accessible application route.
    // Leave the login/error page available for inactive or unconfigured accounts.
    if (!profile || !profile.isActive || getDefaultRouteForUser(profile) === "/staff-login") return;

    if (next && profile.role === "CUSTOMER") redirect(next);
    redirect("/auth/redirect");
  }
}
