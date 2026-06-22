"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useReducer } from "react";
import { useAos } from "@/components/AosInitializer";

type StaffLoginState = {
  email: string;
  password: string;
  error: string;
  loading: boolean;
};

type StaffLoginAction =
  | {
      type: "fieldChanged";
      name: "email" | "password";
      value: string;
    }
  | {
      type: "errorChanged";
      error: string;
    }
  | {
      type: "loginStarted";
    }
  | {
      type: "loginFailed";
      error: string;
    };

const initialStaffLoginState: StaffLoginState = {
  email: "",
  password: "",
  error: "",
  loading: false,
};

function staffLoginReducer(
  state: StaffLoginState,
  action: StaffLoginAction,
): StaffLoginState {
  switch (action.type) {
    case "fieldChanged":
      return {
        ...state,
        [action.name]: action.value,
      };
    case "errorChanged":
      return {
        ...state,
        error: action.error,
      };
    case "loginStarted":
      return {
        ...state,
        error: "",
        loading: true,
      };
    case "loginFailed":
      return {
        ...state,
        error: action.error,
        loading: false,
      };
  }
}

export default function StaffLoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(
    staffLoginReducer,
    initialStaffLoginState,
  );
  const { email, password, error, loading } = state;

  useAos(Boolean(error));

  useEffect(() => {
    const queryError = searchParams.get("error");

    if (queryError === "staff-not-found" || queryError === "staff_not_found") {
      dispatch({
        type: "errorChanged",
        error: "Your staff account was not found.",
      });
    } else if (queryError === "inactive") {
      dispatch({
        type: "errorChanged",
        error: "Your staff account is inactive.",
      });
    } else if (queryError === "unauthorized") {
      dispatch({
        type: "errorChanged",
        error: "You are not authorized to access that staff page.",
      });
    } else {
      dispatch({
        type: "errorChanged",
        error: "",
      });
    }
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    dispatch({ type: "loginStarted" });

    try {
      const response = await fetch("/api/auth/staff-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Login failed.");
      }

      router.replace(data.redirectTo || "/auth/redirect");
    } catch (err) {
      dispatch({
        type: "loginFailed",
        error: err instanceof Error ? err.message : "Login failed.",
      });
    }
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
            <label
              htmlFor="staff-email"
              className="mb-2 block text-sm font-semibold text-[#3a2418]"
            >
              Email
            </label>
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) =>
                dispatch({
                  type: "fieldChanged",
                  name: "email",
                  value: e.target.value,
                })
              }
              className="w-full rounded-2xl border border-[#e4d2bf] bg-white px-4 py-3 text-sm text-[#2f180d] outline-none transition placeholder:text-[#9b8575] focus:border-[#d09a59] focus:ring-4 focus:ring-[#d09a59]/15"
              placeholder="admin@pos.com"
              autoComplete="email"
              required
            />
          </div>

          <div data-aos="fade-up" data-aos-delay="120">
            <label
              htmlFor="staff-password"
              className="mb-2 block text-sm font-semibold text-[#3a2418]"
            >
              Password
            </label>
            <input
              id="staff-password"
              type="password"
              value={password}
              onChange={(e) =>
                dispatch({
                  type: "fieldChanged",
                  name: "password",
                  value: e.target.value,
                })
              }
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
            disabled={loading}
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


