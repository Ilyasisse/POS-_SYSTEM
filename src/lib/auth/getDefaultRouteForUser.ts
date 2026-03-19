type AppUser = {
  role: string;
  station: string | null;
};

export function getDefaultRouteForUser(user: AppUser) {
  const isCabitaanRole = user.role === "CABITAAN" || user.role === "Cabitaan";

  if (user.role === "ADMIN") return "/admin";
  if (user.role === "MANAGER") return "/manager";
  if (user.role === "CASHIER") return "/cashier";
  if (user.role === "WAITER") return "/waiter";
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

  return "/login";
}
