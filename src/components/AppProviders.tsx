"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import posthog from "posthog-js";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

const posthogConfigured = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

type SessionUser = {
  id: string;
  email?: string;
  name?: string;
  role?: string;
};

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!posthogConfigured) return;

    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { user?: SessionUser };
      })
      .then((session) => {
        if (!session?.user) return;

        posthog.identify(session.user.id, {
          email: session.user.email,
          name: session.user.name,
          role: session.user.role,
        });
      })
      .catch(() => undefined);
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={250}>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
