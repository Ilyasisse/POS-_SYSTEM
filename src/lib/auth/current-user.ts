import { cache } from "react";

import { findAppUser } from "@/lib/auth/app-user";
import { createClient } from "@/lib/supabase/server";

async function resolveCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  return findAppUser(authUser.id);
}

// React clears this cache after each Server Component render, so layouts and
// nested pages share one verified lookup without sharing user data across requests.
export const getCurrentUser = cache(resolveCurrentUser);
