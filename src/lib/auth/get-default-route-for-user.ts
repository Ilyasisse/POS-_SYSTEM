type AppUser = {
  role: string;
  station: string | null;
};

/**
 * Returns the default route for a signed-in user based on role and station.
 *
 * Dashboard roles go to their dashboards, customer users go to the menu, and
 * kitchen staff are routed to the correct station screen when possible.
 *
 * @param user - User role and station data used for routing.
 * @returns The route path the user should be sent to after login.
 */
export function getDefaultRouteForUser(user: AppUser) {
  const isCabitaanRole = user.role === "CABITAAN" || user.role === "Cabitaan";

  if (user.role === "ADMIN") return "/admin";
  if (user.role === "MANAGER") return "/manager";
  if (user.role === "CASHIER") return "/cashier";
  if (user.role === "WAITER") return "/waiter";
  if (user.role === "CUSTOMER") return "/menu";
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

  return "/staff-login";
}
