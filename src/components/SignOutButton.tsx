"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/staff-login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
    >
      Ka bax
    </button>
  );
}
