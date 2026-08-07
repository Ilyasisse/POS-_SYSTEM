export type AuthCookieStore = {
  getAll(): readonly { name: string }[];
  set(cookie: {
    name: string;
    value: string;
    path: string;
    sameSite: "lax";
    httpOnly: false;
    maxAge: number;
    expires: Date;
  }): unknown;
};

export type LocalSignOutClient = {
  auth: {
    signOut(options: {
      scope: "local";
    }): PromiseLike<{ error: unknown | null }>;
  };
};

export function getSupabaseAuthCookiePrefix(supabaseUrl: string) {
  let hostname: string;
  try {
    hostname = new URL(supabaseUrl).hostname;
  } catch {
    throw new Error("The Supabase URL is invalid.");
  }

  const projectReference = hostname.split(".")[0]?.trim();
  if (!projectReference) {
    throw new Error("The Supabase URL is missing its project reference.");
  }
  return `sb-${projectReference}-auth-token`;
}

export function isProjectAuthCookie(
  cookieName: string,
  authCookiePrefix: string,
) {
  return (
    cookieName === authCookiePrefix ||
    cookieName.startsWith(`${authCookiePrefix}.`) ||
    cookieName === `${authCookiePrefix}-code-verifier` ||
    cookieName.startsWith(`${authCookiePrefix}-code-verifier.`) ||
    cookieName === `${authCookiePrefix}-user` ||
    cookieName.startsWith(`${authCookiePrefix}-user.`)
  );
}

export function clearProjectAuthCookies(
  cookieStore: AuthCookieStore,
  supabaseUrl: string,
) {
  const authCookiePrefix = getSupabaseAuthCookiePrefix(supabaseUrl);
  const clearedCookieNames: string[] = [];

  for (const cookie of cookieStore.getAll()) {
    if (!isProjectAuthCookie(cookie.name, authCookiePrefix)) continue;
    cookieStore.set({
      name: cookie.name,
      value: "",
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 0,
      expires: new Date(0),
    });
    clearedCookieNames.push(cookie.name);
  }

  return clearedCookieNames;
}

export async function signOutStaffSession(input: {
  client: LocalSignOutClient;
  cookieStore: AuthCookieStore;
  supabaseUrl: string;
  onRemoteSignOutError?: (error: unknown) => void;
}) {
  const { error } = await input.client.auth.signOut({ scope: "local" });
  const clearedCookieNames = clearProjectAuthCookies(
    input.cookieStore,
    input.supabaseUrl,
  );

  if (error) input.onRemoteSignOutError?.(error);

  return {
    clearedCookieNames,
    remoteSignOutSucceeded: error === null,
  };
}
