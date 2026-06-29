"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAos } from "@/components/AosInitializer";

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

export default function LoginPageClient() {
  const searchParams = useSearchParams();
  const [runtimeError, setRuntimeError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const error = runtimeError || loginErrorMessage(searchParams.get("error"));

  useAos(Boolean(error));

  async function handleGoogleSignIn() {
    setRuntimeError("");
    setGoogleLoading(true);

    try {
      window.location.assign("/auth/google/start");
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
        className="w-full max-w-md rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_26px_80px_rgba(65,39,21,0.16)] backdrop-blur sm:p-7"
      >
        <div data-aos="zoom-in" className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#f3dcc1] shadow-[0_18px_40px_rgba(176,123,69,0.18)]">
            <Image
              src="/newer_logo.png"
              alt="Mash Allah Cafe"
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
            />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-[#b07b45]">
            Mash Allah Cafe
          </p>
          <h1 className="mt-3 text-3xl font-bold text-[#2f180d]">
            Customer login
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#725c4c]">
            Sign in with Google to browse the menu and continue your order.
          </p>
        </div>

        {error ? (
          <div
            data-aos="fade-down"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-7 space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            data-aos="fade-up"
            data-aos-delay="80"
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#2f180d] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(47,24,13,0.22)] transition hover:-translate-y-0.5 hover:bg-[#442719] focus:outline-none focus:ring-2 focus:ring-[#d09a59] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-bold text-[#2f180d]"
            >
              G
            </span>
            {googleLoading ? "Opening Google..." : "Continue with Google"}
          </button>

         
        </div>

       
      </section>
    </LoginShell>
  );
}

function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7efe6] px-4 py-10 text-[#2f180d] sm:px-6">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#fff8ef_0%,#f2dfc7_48%,#e8c18f_100%)]" />
      <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(47,24,13,0.16),transparent)]" />
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </main>
  );
}

