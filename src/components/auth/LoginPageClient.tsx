"use client";

import { Button } from "@/components/ui/button";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAos } from "@/components/AosInitializer";
import { LoginHeading, LoginShell } from "./LoginShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { CustomerReturnPath } from "@/lib/auth/customer-return-path";

function loginErrorMessage(error: string | null) {
  if (error === "customer-login-required") {
    return "Please sign in with Google to place a customer order.";
  }

  if (error === "google-signin-failed") {
    return "Google sign in failed. Please try again.";
  }

  if (error === "unauthorized") {
    return "You are not authorized to access that page.";
  }

  return "";
}

export default function LoginPageClient({ destination }: { destination: CustomerReturnPath | null }) {
  const searchParams = useSearchParams();
  const [runtimeError, setRuntimeError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const error = runtimeError || loginErrorMessage(searchParams.get("error"));

  useAos(Boolean(error));

  async function handleGoogleSignIn() {
    setRuntimeError("");
    setGoogleLoading(true);

    try {
      window.location.assign(
        destination
          ? `/auth/google/start?next=${encodeURIComponent(destination)}`
          : "/auth/google/start",
      );
    } catch (err) {
      setGoogleLoading(false);
      setRuntimeError(
        err instanceof Error ? err.message : "Google sign in failed.",
      );
    }
  }

  return (
    <LoginShell>
      <section
        data-aos="fade-up"
        className="w-full max-w-md rounded-[30px] border border-border bg-card/90 p-6 shadow-[0_26px_80px_rgba(65,39,21,0.16)] backdrop-blur sm:p-7"
      >
        <LoginHeading
          eyebrow="Mash Allah Cafe"
          title="Customer login"
          description="Browse the menu freely. Sign in with Google when you are ready to place your order."
        />

        {error ? (
          <Alert data-aos="fade-down" variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-7 space-y-3">
          <Button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            data-aos="fade-up"
            data-aos-delay="80"
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_18px_36px_rgba(47,24,13,0.22)] transition hover:-translate-y-0.5 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-card text-sm font-bold text-foreground"
            >
              G
            </span>
            {googleLoading ? "Opening Google..." : "Continue with Google"}
          </Button>
        </div>
      </section>
    </LoginShell>
  );
}
