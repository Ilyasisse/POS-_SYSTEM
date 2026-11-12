import "server-only";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCafeteria } from "./context";

export async function requirePlatformAdmin() {
  const [user, cafeteria] = await Promise.all([getCurrentUser(), getCafeteria()]);
  if (!user?.isActive || user.role !== "ADMIN" || cafeteria.id !== "mashallah" ||
      !("isPlatformAdmin" in user && user.isPlatformAdmin)) {
    throw new Error("Only the Mashallah platform administrator can manage cafeterias.");
  }
  return user;
}
