"use client";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useReducer } from "react";
import { useAos } from "@/components/AosInitializer";
import { LoginHeading, LoginShell } from "./LoginShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import posthog from "posthog-js";

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
        user?: {
          id: string;
          email: string;
          name: string;
          role: string;
        };
      };

      if (!response.ok) {
        throw new Error(data.error || "Login failed.");
      }

      if (
        data.user &&
        process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
        process.env.NEXT_PUBLIC_POSTHOG_HOST
      ) {
        posthog.identify(data.user.id, {
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
        });
        posthog.capture("staff_login_succeeded", {
          staff_role: data.user.role,
        });
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
    <LoginShell>
      <section
        data-aos="fade-up"
        className="w-full max-w-md rounded-[30px] border border-border bg-card/90 p-6 shadow-[0_26px_80px_rgba(65,39,21,0.16)] backdrop-blur sm:p-7"
      >
        <LoginHeading
          eyebrow="Staff access"
          title="Staff login"
          description="Sign in with your cafe email and password to open your workspace."
        />

        <form onSubmit={handleLogin} className="mt-7 space-y-4">
          <div data-aos="fade-up" data-aos-delay="80">
            <label
              htmlFor="staff-email"
              className="mb-2 block text-sm font-semibold text-foreground"
            >
              Email
            </label>
            <Input
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
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-[#2f180d] outline-none transition placeholder:text-[#9b8575] focus:border-[#d09a59] focus:ring-4 focus:ring-ring/15"
              placeholder="admin@pos.com"
              autoComplete="email"
              required
            />
          </div>

          <div data-aos="fade-up" data-aos-delay="120">
            <label
              htmlFor="staff-password"
              className="mb-2 block text-sm font-semibold text-foreground"
            >
              Password
            </label>
            <Input
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
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-[#2f180d] outline-none transition placeholder:text-[#9b8575] focus:border-[#d09a59] focus:ring-4 focus:ring-ring/15"
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <Alert data-aos="fade-down" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            disabled={loading}
            data-aos="fade-up"
            data-aos-delay="160"
            className="flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_18px_36px_rgba(47,24,13,0.22)] transition hover:-translate-y-0.5 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {loading ? "Signing in..." : "Sign in to staff"}
          </Button>
        </form>

        <div className="mt-5">
          <Link
            prefetch={false}
            href="/login"
            data-aos="fade-up"
            data-aos-delay="220"
            className="flex w-full items-center justify-center rounded-2xl border border-border bg-card px-5 py-3.5 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-[#d09a59] hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            Customer login
          </Link>
        </div>
      </section>
    </LoginShell>
  );
}
