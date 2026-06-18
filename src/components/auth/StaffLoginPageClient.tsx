"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAos } from "@/components/AosInitializer";
import { createClient } from "@/lib/supabase/client";
import { getDefaultRouteForUser } from "@/lib/auth/get-default-route-for-user"

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

export default function StaffLoginPageClient() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useAos([checkingSession, Boolean(error)]);

  useEffect(() => {
    const queryError = searchParams.get("error");

    if (queryError === "staff-not-found" || queryError === "staff_not_found") {
      setError("Your staff account was not found.");
    } else if (queryError === "inactive") {
      setError("Your staff account is inactive.");
    } else if (queryError === "unauthorized") {
      setError("You are not authorized to access that staff page.");
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
          setCheckingSession(false);
          return;
        }

        router.replace(getDefaultRouteForUser(me.data));
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

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!supabase) {
        throw new Error(
          "Supabase environment variables are missing. Update the project settings and redeploy.",
        );
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      const me = await fetchMe();

      if (!me.ok || !me.data) {
        await supabase.auth.signOut();
        throw new Error(me.error || "Unable to find your staff account.");
      }

      if (me.data.role === "CUSTOMER") {
        await supabase.auth.signOut();
        throw new Error("Customer accounts should use the customer login page.");
      }

      router.replace(getDefaultRouteForUser(me.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <StaffLoginShell>
        <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/85 p-6 text-center shadow-[0_24px_70px_rgba(65,39,21,0.14)] backdrop-blur">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-[#d09a59]/30" />
          <p className="text-sm font-medium text-[#6d5445]">
            Checking staff session...
          </p>
        </div>
      </StaffLoginShell>
    );
  }

  return (
    <StaffLoginShell>
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
            Staff access
          </p>
          <h1 className="mt-3 text-3xl font-bold text-[#2f180d]">
            Staff login
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#725c4c]">
            Sign in with your cafe email and password to open your workspace.
          </p>
        </div>

        <form onSubmit={handleLogin} className="mt-7 space-y-4">
          <div data-aos="fade-up" data-aos-delay="80">
            <label className="mb-2 block text-sm font-semibold text-[#3a2418]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-[#e4d2bf] bg-white px-4 py-3 text-sm text-[#2f180d] outline-none transition placeholder:text-[#9b8575] focus:border-[#d09a59] focus:ring-4 focus:ring-[#d09a59]/15"
              placeholder="admin@pos.com"
              autoComplete="email"
              required
            />
          </div>

          <div data-aos="fade-up" data-aos-delay="120">
            <label className="mb-2 block text-sm font-semibold text-[#3a2418]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-[#e4d2bf] bg-white px-4 py-3 text-sm text-[#2f180d] outline-none transition placeholder:text-[#9b8575] focus:border-[#d09a59] focus:ring-4 focus:ring-[#d09a59]/15"
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <div
              data-aos="fade-down"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !supabase}
            data-aos="fade-up"
            data-aos-delay="160"
            className="flex w-full items-center justify-center rounded-2xl bg-[#2f180d] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(47,24,13,0.22)] transition hover:-translate-y-0.5 hover:bg-[#442719] focus:outline-none focus:ring-2 focus:ring-[#d09a59] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {loading ? "Signing in..." : "Sign in to staff"}
          </button>
        </form>

        <div className="mt-5">
          <Link
            href="/login"
            data-aos="fade-up"
            data-aos-delay="220"
            className="flex w-full items-center justify-center rounded-2xl border border-[#e4d2bf] bg-white px-5 py-3.5 text-sm font-semibold text-[#3a2418] transition hover:-translate-y-0.5 hover:border-[#d09a59] hover:bg-[#fff8f0] focus:outline-none focus:ring-2 focus:ring-[#d09a59] focus:ring-offset-2"
          >
            Customer login
          </Link>
        </div>
      </section>
    </StaffLoginShell>
  );
}

function StaffLoginShell({ children }: { children: React.ReactNode }) {
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


