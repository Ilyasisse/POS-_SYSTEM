"use client";

import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type SignOutButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "onClick" | "type"
> & {
  label?: string;
};

export default function SignOutButton({
  label = "Sign out",
  variant = "destructive",
  ...props
}: SignOutButtonProps) {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/staff-login");
    router.refresh();
  }

  return (
    <Button
      type="submit"
      onClick={handleSignOut}
      variant={variant}
      {...props}
    >
      <LogOut data-icon="inline-start" />
      {label}
    </Button>
  );
}
