"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const supabase = createClient();
  const router = useRouter();

  async function handleSignOut() {
    if (!supabase) {
      router.replace("/staff-login");
      router.refresh();
      return;
    }

    await supabase.auth.signOut();
    router.replace("/staff-login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={!supabase}
      className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      Ka bax
    </button>
  );
}
