"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MeResponse = {
  id: string;
  fullName: string;
  role: string;
  station: string | null;
  isActive: boolean;
};

export default function LoginPageClient() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const queryError = searchParams.get("error");

    if (queryError === "staff-not-found") {
      setError("Your staff account was not found.");
    } else if (queryError === "inactive") {
      setError("Your staff account is inactive.");
    } else if (queryError === "unauthorized") {
      setError("You are not authorized to access that page.");
    }
  }, [searchParams]);

  useEffect(() => {
    const supabaseClient = supabase;

    if (!supabaseClient) {
      setCheckingSession(false);
      setError(
        "Supabase environment variables are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
      );
      return;
    }

    const client = supabaseClient;
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

        redirectByRoleAndStation(me.data.role, me.data.station, router);
      } catch (err) {
        console.error("Session check failed:", err);

        if (!mounted) return;
        setCheckingSession(false);
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
          "Supabase environment variables are missing. Update the Vercel project settings and redeploy.",
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

      redirectByRoleAndStation(me.data.role, me.data.station, router);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchMe(): Promise<{
    ok: boolean;
    data: MeResponse | null;
    error: string | null;
  }> {
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
          data: null,
          error: errorMessage,
        };
      }

      return {
        ok: true,
        data: parsed as MeResponse,
        error: null,
      };
    } catch (err) {
      console.error("fetchMe failed:", err);
      return {
        ok: false,
        data: null,
        error: "Could not reach /api/me.",
      };
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-center text-sm text-slate-600">
            Checking session...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            MASH ALLAH Cafe POS
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Staff Login
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Sign in with your staff account
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              placeholder="admin@pos.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !supabase}
            className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}

function redirectByRoleAndStation(
  role: string,
  station: string | null,
  router: ReturnType<typeof useRouter>
) {
  if (role === "ADMIN") {
    router.replace("/admin");
    return;
  }

  if (role === "WAITER") {
    router.replace("/waiter");
    return;
  }

  if (role === "CASHIER") {
    router.replace("/cashier");
    return;
  }

  if (role === "BARISTA") {
    router.replace("/kitchen/barista");
    return;
  }

  if (role === "CABITAAN" || role === "Cabitaan") {
    router.replace("/kitchen/cabitaan");
    return;
  }

  if (role === "COOK") {
    if (station === "BARISTA") {
      router.replace("/kitchen/barista");
      return;
    }

    if (station === "CABITAAN") {
      router.replace("/kitchen/cabitaan");
      return;
    }

    if (station === "FAST_FOOD") {
      router.replace("/kitchen/fast-food");
      return;
    }

    if (station === "CUNTO_SOOMAALI") {
      router.replace("/kitchen/cunto-soomaali");
      return;
    }

    router.replace("/kitchen");
    return;
  }

  router.replace("/login");
}
