export type UserRole =
  | "ADMIN"
  | "MANAGER"
  | "CASHIER"
  | "WAITER"
  | "COOK"
  | "BARISTA"
  | "CABITAAN"
  | "Cabitaan";

export type AppUser = {
  id: string;
  email: string | null;
  fullName: string;
  role: UserRole;
  station: string | null;
  isActive: boolean;
};

export function getDefaultRouteForUser(user: AppUser) {
  const isCabitaanRole = user.role === "CABITAAN" || user.role === "Cabitaan";

  if (user.role === "ADMIN" || user.role === "MANAGER") {
    return "/admin";
  }

  if (user.role === "CASHIER") {
    return "/cashier";
  }

  if (user.role === "WAITER") {
    return "/waiter";
  }

  if (user.role === "BARISTA" || user.station === "BARISTA") {
    return "/kitchen/barista";
  }

  if (isCabitaanRole || user.station === "CABITAAN") {
    return "/kitchen/cabitaan";
  }

  if (user.role === "COOK" && user.station === "FAST_FOOD") {
    return "/kitchen/fast-food";
  }

  if (user.role === "COOK" && user.station === "CUNTO_SOOMAALI") {
    return "/kitchen/cunto-soomaali";
  }

  return "/kitchen";
}

export function canAccessPath(pathname: string, user: AppUser) {
  const isCabitaanRole = user.role === "CABITAAN" || user.role === "Cabitaan";

  if (pathname.startsWith("/admin")) {
    return user.role === "ADMIN" || user.role === "MANAGER";
  }

  if (pathname.startsWith("/cashier")) {
    return user.role === "CASHIER";
  }

  if (pathname.startsWith("/waiter")) {
    return user.role === "WAITER";
  }

  if (pathname.startsWith("/kitchen")) {
    return (
      user.role === "ADMIN" ||
      user.role === "BARISTA" ||
      user.role === "COOK" ||
      isCabitaanRole
    );
  }

  return true;
}
