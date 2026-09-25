import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { findAppUser } from "@/lib/auth/app-user";

export async function redirectAuthenticatedUser(
  next: "/customer" | null = null,
) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Keep login routes from rendering stale UI before /auth/redirect chooses the user's destination.
  if (!error && user) {
    if (next) {
      const profile = await findAppUser(user.id);
      if (profile?.role === "CUSTOMER" && profile.isActive) redirect(next);
    }
    redirect("/auth/redirect");
  }
}
