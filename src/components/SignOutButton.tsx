"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type SignOutButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "onClick" | "type"
> & {
  label?: string;
};

type SignOutState = "idle" | "pending" | "failed";

export default function SignOutButton({
  label = "Sign out",
  variant = "destructive",
  disabled,
  ...props
}: SignOutButtonProps) {
  const [state, setState] = useState<SignOutState>("idle");
  const pending = state === "pending";

  async function handleSignOut() {
    if (pending) return;
    setState("pending");

    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(result?.error || "Sign out failed.");
      }

      window.location.replace("/staff-login");
    } catch {
      setState("failed");
    }
  }

  const visibleLabel = pending
    ? "Signing out..."
    : state === "failed"
      ? "Sign out failed — retry"
      : label;

  return (
    <Button
      type="button"
      onClick={handleSignOut}
      variant={variant}
      disabled={disabled || pending}
      aria-busy={pending}
      {...props}
    >
      <LogOut data-icon="inline-start" />
      <span aria-live="polite">{visibleLabel}</span>
    </Button>
  );
}
