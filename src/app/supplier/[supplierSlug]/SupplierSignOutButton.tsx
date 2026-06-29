"use client";

import { useRouter } from "next/navigation";

export default function SupplierSignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/signout", { method: "POST" });
        router.refresh();
      }}
      className="mt-4 text-sm font-bold underline"
    >
      Sign out and use another account
    </button>
  );
}
