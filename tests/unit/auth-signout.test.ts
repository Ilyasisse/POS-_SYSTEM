import assert from "node:assert/strict";
import test from "node:test";
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
  assert.equal(
    getSupabaseAuthCookiePrefix(SUPABASE_URL),
    AUTH_COOKIE_PREFIX,
  );
  assert.throws(
    () => getSupabaseAuthCookiePrefix("not a url"),
    /Supabase URL is invalid/,
  );
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
    assert.equal(isProjectAuthCookie(name, AUTH_COOKIE_PREFIX), true);
  }

  for (const name of [
    "sidebar_state",
    "theme",
    "sb-other-project-auth-token",
    `${AUTH_COOKIE_PREFIX}-unrelated`,
  ]) {
    assert.equal(isProjectAuthCookie(name, AUTH_COOKIE_PREFIX), false);
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

  assert.deepEqual(cleared, [
    `${AUTH_COOKIE_PREFIX}.0`,
    `${AUTH_COOKIE_PREFIX}.1`,
    `${AUTH_COOKIE_PREFIX}-code-verifier`,
  ]);
  assert.deepEqual(
    expired.map(({ name }) => name),
    cleared,
  );
  for (const cookie of expired) {
    assert.equal(cookie.value, "");
    assert.equal(cookie.path, "/");
    assert.equal(cookie.sameSite, "lax");
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.secure, true);
    assert.equal(cookie.maxAge, 0);
    assert.equal(cookie.expires.getTime(), 0);
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

  assert.deepEqual(scopes, ["local"]);
  assert.equal(result.remoteSignOutSucceeded, true);
  assert.equal(expired.length, 1);
});

test("still clears the local session when remote revocation fails", async () => {
  const { expired, store } = cookieStore([
    `${AUTH_COOKIE_PREFIX}.0`,
    "sidebar_state",
  ]);
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

  assert.equal(result.remoteSignOutSucceeded, false);
  assert.deepEqual(result.clearedCookieNames, [
    `${AUTH_COOKIE_PREFIX}.0`,
  ]);
  assert.deepEqual(
    expired.map(({ name }) => name),
    [`${AUTH_COOKIE_PREFIX}.0`],
  );
  assert.deepEqual(reportedErrors, [remoteError]);
});
