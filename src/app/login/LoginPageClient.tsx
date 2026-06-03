"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAos } from "@/app/components/AosInitializer";
import { createClient } from "@/lib/supabase/client";

type MeResponse = {
  id: string;
  fullName: string;
  role: string;
  station: string | null;
  isActive: boolean;
};

type FetchMeResult = {
  ok: boolean;
  status: number;
  data: MeResponse | null;
  error: string | null;
};

const CUSTOMER_MENU_PATH = "/menu";

export default function LoginPageClient() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useAos([checkingSession, Boolean(error)]);

  useEffect(() => {
    const queryError = searchParams.get("error");

    if (queryError === "customer-login-required") {
      setError("Please sign in with Google to place a customer order.");
    } else if (queryError === "google-signin-failed") {
      setError("Google sign in failed. Please try again.");
    } else if (queryError === "unauthorized") {
      setError("You are not authorized to access that page.");
    } else {
      setError("");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      setError(
        "Supabase environment variables are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const client = supabase;
    let mounted = true;

    async function checkExistingSession() {
      try {
        const {
          data: { user },
        } = await client.auth.getUser();

        if (!mounted) return;

        if (!user) {
          setCheckingSession(false);
          return;
        }

        const me = await fetchMe();

        if (!mounted) return;

        if (!me.ok || !me.data) {
          if (me.status === 404) {
            window.location.assign(CUSTOMER_MENU_PATH);
            return;
          }

          setCheckingSession(false);
          return;
        }

        router.replace(getDefaultRouteForProfile(me.data));
      } catch (err) {
        console.error("Session check failed:", err);

        if (mounted) {
          setCheckingSession(false);
        }
      }
    }

    checkExistingSession();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);

    try {
      if (!supabase) {
        throw new Error(
          "Supabase environment variables are missing. Update the project settings and redeploy.",
        );
      }

      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", CUSTOMER_MENU_PATH);

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (signInError) {
        throw new Error(signInError.message);
      }
    } catch (err) {
      setGoogleLoading(false);
      setError(err instanceof Error ? err.message : "Google sign in failed.");
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
            disabled={googleLoading || !supabase}
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

async function fetchMe(): Promise<FetchMeResult> {
  try {
    const response = await fetch("/api/me", {
      method: "GET",
      cache: "no-store",
    });

    const raw = await response.text();
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("/api/me returned non-JSON:", raw);

      return {
        ok: false,
        status: response.status,
        data: null,
        error: "The /api/me route returned HTML instead of JSON.",
      };
    }

    if (!response.ok) {
      const errorMessage =
        typeof parsed === "object" &&
        parsed !== null &&
        "error" in parsed &&
        typeof (parsed as { error?: unknown }).error === "string"
          ? (parsed as { error: string }).error
          : "Request failed";

      return {
        ok: false,
        status: response.status,
        data: null,
        error: errorMessage,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: parsed as MeResponse,
      error: null,
    };
  } catch (err) {
    console.error("fetchMe failed:", err);

    return {
      ok: false,
      status: 0,
      data: null,
      error: "Could not reach /api/me.",
    };
  }
}

function getDefaultRouteForProfile(user: MeResponse) {
  if (user.role === "ADMIN") return "/admin";
  if (user.role === "MANAGER") return "/manager";
  if (user.role === "CASHIER") return "/cashier";
  if (user.role === "WAITER") return "/waiter";
  if (user.role === "CUSTOMER") return "/menu";
  if (user.role === "BARISTA" || user.station === "BARISTA") {
    return "/kitchen/barista";
  }

  if (
    user.role === "CABITAAN" ||
    user.role === "Cabitaan" ||
    user.station === "CABITAAN"
  ) {
    return "/kitchen/cabitaan";
  }

  if (user.role === "COOK" && user.station === "FAST_FOOD") {
    return "/kitchen/fast-food";
  }

  if (user.role === "COOK" && user.station === "CUNTO_SOOMAALI") {
    return "/kitchen/cunto-soomaali";
  }

  return "/menu";
}
