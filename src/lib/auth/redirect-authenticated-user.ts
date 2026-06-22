import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function redirectAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Keep login routes from rendering stale UI before /auth/redirect chooses the user's destination.
  if (!error && user) {
    redirect("/auth/redirect");
  }
}
