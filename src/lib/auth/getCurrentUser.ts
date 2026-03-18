import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth/roles";

export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    redirect("/login");
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("User")
    .select("id, email, fullName, role, station, isActive")
    .eq("id", authUser.id)
    .single<AppUser>();

  if (appUserError || !appUser) {
    redirect("/login");
  }

  if (!appUser.isActive) {
    redirect("/login");
  }

  return appUser;
}