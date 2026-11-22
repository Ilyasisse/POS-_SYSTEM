import { expect, test } from "@jest/globals";

import {
  clearProjectAuthCookies,
  getSupabaseAuthCookiePrefix,
  isProjectAuthCookie,
  signOutStaffSession,
  type AuthCookieStore,
} from "../../src/lib/auth/signout-session";

const SUPABASE_URL = "https://cafe-project.supabase.co";
const AUTH_COOKIE_PREFIX = "sb-cafe-project-auth-token";

function cookieStore(cookieNames: string[]) {
  const expired: Parameters<AuthCookieStore["set"]>[0][] = [];
  const store: AuthCookieStore = {
    getAll: () => cookieNames.map((name) => ({ name })),
    set: (cookie) => {
      expired.push(cookie);
    },
  };
  return { expired, store };
}

test("derives the project-specific Supabase auth cookie prefix", () => {
  expect(getSupabaseAuthCookiePrefix(SUPABASE_URL)).toBe(AUTH_COOKIE_PREFIX);
  expect(() => getSupabaseAuthCookiePrefix("not a url")).toThrow(/Supabase URL is invalid/);
});

test("recognizes only the current project's auth cookies and chunks", () => {
  for (const name of [
    AUTH_COOKIE_PREFIX,
    `${AUTH_COOKIE_PREFIX}.0`,
    `${AUTH_COOKIE_PREFIX}.12`,
    `${AUTH_COOKIE_PREFIX}-code-verifier`,
    `${AUTH_COOKIE_PREFIX}-code-verifier.0`,
    `${AUTH_COOKIE_PREFIX}-user`,
    `${AUTH_COOKIE_PREFIX}-user.1`,
  ]) {
    expect(isProjectAuthCookie(name, AUTH_COOKIE_PREFIX)).toBe(true);
  }

  for (const name of [
    "sidebar_state",
    "theme",
    "sb-other-project-auth-token",
    `${AUTH_COOKIE_PREFIX}-unrelated`,
  ]) {
    expect(isProjectAuthCookie(name, AUTH_COOKIE_PREFIX)).toBe(false);
  }
});

test("expires project auth cookies without touching unrelated cookies", () => {
  const { expired, store } = cookieStore([
    `${AUTH_COOKIE_PREFIX}.0`,
    `${AUTH_COOKIE_PREFIX}.1`,
    `${AUTH_COOKIE_PREFIX}-code-verifier`,
    "sidebar_state",
    "sb-other-project-auth-token",
  ]);

  const cleared = clearProjectAuthCookies(store, SUPABASE_URL);

  expect(cleared).toStrictEqual([
    `${AUTH_COOKIE_PREFIX}.0`,
    `${AUTH_COOKIE_PREFIX}.1`,
    `${AUTH_COOKIE_PREFIX}-code-verifier`,
  ]);
  expect(expired.map(({ name }) => name)).toStrictEqual(cleared);
  for (const cookie of expired) {
    expect(cookie.value).toBe("");
    expect(cookie.path).toBe("/");
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.maxAge).toBe(0);
    expect(cookie.expires.getTime()).toBe(0);
  }
});

test("uses local scope and clears cookies after successful revocation", async () => {
  const { expired, store } = cookieStore([AUTH_COOKIE_PREFIX]);
  const scopes: string[] = [];

  const result = await signOutStaffSession({
    client: {
      auth: {
        async signOut({ scope }) {
          scopes.push(scope);
          return { error: null };
        },
      },
    },
    cookieStore: store,
    supabaseUrl: SUPABASE_URL,
  });

  expect(scopes).toStrictEqual(["local"]);
  expect(result.remoteSignOutSucceeded).toBe(true);
  expect(expired.length).toBe(1);
});

test("still clears the local session when remote revocation fails", async () => {
  const { expired, store } = cookieStore([`${AUTH_COOKIE_PREFIX}.0`, "sidebar_state"]);
  const remoteError = new Error("Supabase is unavailable");
  const reportedErrors: unknown[] = [];

  const result = await signOutStaffSession({
    client: {
      auth: {
        async signOut() {
          return { error: remoteError };
        },
      },
    },
    cookieStore: store,
    supabaseUrl: SUPABASE_URL,
    onRemoteSignOutError: (error) => reportedErrors.push(error),
  });

  expect(result.remoteSignOutSucceeded).toBe(false);
  expect(result.clearedCookieNames).toStrictEqual([`${AUTH_COOKIE_PREFIX}.0`]);
  expect(expired.map(({ name }) => name)).toStrictEqual([`${AUTH_COOKIE_PREFIX}.0`]);
  expect(reportedErrors).toStrictEqual([remoteError]);
});
