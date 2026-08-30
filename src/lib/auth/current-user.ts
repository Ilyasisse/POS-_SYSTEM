import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function resolveCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  return prisma.user.findUnique({ where: { id: authUser.id } });
}

// React clears this cache after each Server Component render, so layouts and
// nested pages share one verified lookup without sharing user data across requests.
export const getCurrentUser = cache(resolveCurrentUser);
