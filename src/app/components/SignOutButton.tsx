"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const supabase = createClient();
  const router = useRouter();

  async function handleSignOut() {
    if (!supabase) {
      router.replace("/login");
      router.refresh();
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={!supabase}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
    >
      Ka bax
    </button>
  );
}
