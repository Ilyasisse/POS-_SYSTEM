import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getDefaultRouteForUser } from "@/lib/auth/roles";

export default async function HomePage() {
  const user = await getCurrentUser();

  redirect(getDefaultRouteForUser(user));
}
