import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { findAppUser } from "@/lib/auth/app-user";
import type { CustomerReturnPath } from "@/lib/auth/customer-return-path";

export async function redirectAuthenticatedUser(
  customerDestination: CustomerReturnPath | null = null,
) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Keep login routes from rendering stale UI before /auth/redirect chooses the user's destination.
  if (!error && user) {
    if (customerDestination) {
      const profile = await findAppUser(user.id);
      if (profile?.role === "CUSTOMER" && profile.isActive) redirect(customerDestination);
    }
    redirect("/auth/redirect");
  }
}
