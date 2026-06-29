"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/staff-login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      onClick={handleSignOut}
      variant="destructive"
    >
      <LogOut data-icon="inline-start" />
      Sign out
    </Button>
  );
}
