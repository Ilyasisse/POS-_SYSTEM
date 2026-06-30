"use client";

import { Button } from "@/components/ui/button";

import { useRouter } from "next/navigation";

export default function SupplierSignOutButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/signout", { method: "POST" });
        router.refresh();
      }}
      variant="outline"
      className="mt-4"
    >
      Sign out and use another account
    </Button>
  );
}
