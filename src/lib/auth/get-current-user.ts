import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  station: string | null;
  isActive: boolean;
};

/**
 * Loads the currently authenticated active application user.
 *
 * Uses the Supabase auth session to find the matching row in the `User` table.
 * Redirects to staff login when the session is missing, the app user cannot be
 * found, or the account is inactive.
 *
 * @returns The active application user for the current Supabase session.
 */
export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    redirect("/staff-login");
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("User")
    .select("id, email, fullName, role, station, isActive")
    .eq("id", authUser.id)
    .single<AppUser>();

  if (appUserError || !appUser) {
    redirect("/staff-login?error=staff_not_found");
  }

  if (!appUser.isActive) {
    redirect("/staff-login?error=inactive");
  }

  return appUser;
}
