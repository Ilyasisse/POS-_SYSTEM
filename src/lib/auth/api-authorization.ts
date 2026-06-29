import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasAnyPermission, type Permission } from "@/lib/auth/permissions";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
type ApiAuthorizationResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; response: NextResponse };

export async function authorizeApi(
  permission: Permission,
): Promise<ApiAuthorizationResult> {
  return authorizeApiAny([permission]);
}

export async function authorizeApiAny(
  permissions: readonly Permission[],
): Promise<ApiAuthorizationResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  if (!user.isActive || !hasAnyPermission(user, permissions)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { ok: true, user };
}
