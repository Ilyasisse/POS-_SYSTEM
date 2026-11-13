"use client";

import type { ReactNode } from "react";
import { useClientResource } from "@/hooks/useClientResource";
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

async function loadSession(signal: AbortSignal) {
  const response = await fetch("/api/auth/session", { cache: "no-store", signal });
  return response.ok ? (response.json() as Promise<{ user?: SessionUser }>) : null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  useClientResource({
    load: loadSession,
    enabled: posthogConfigured,
    onData(session) {
      if (!session?.user) return;
      posthog.identify(session.user.id, {
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      });
    },
  });

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
