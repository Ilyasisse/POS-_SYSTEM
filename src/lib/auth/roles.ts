export type UserRole =
  | "ADMIN"
  | "MANAGER"
  | "CASHIER"
  | "WAITER"
  | "KITCHEN"
  | "BARISTA";

export type AppUser = {
  id: string;
  email: string | null;
  fullName: string;
  role: UserRole;
  station: string | null;
  isActive: boolean;
};

export function getDefaultRouteForUser(user: AppUser) {
  switch (user.role) {
    case "ADMIN":
    case "MANAGER":
      return "/admin";
    case "CASHIER":
      return "/cashier";
    case "WAITER":
      return "/waiter";
    case "KITCHEN":
      return "/kitchen";
    case "BARISTA":
      return "/kitchen";

    default:
      return "/login";
  }
}

export function canAccessPath(pathname: string, user: AppUser) {
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
    return user.role === "KITCHEN";
  }
  if (pathname.startsWith("/kitchen")) {
    return user.role === "BARISTA";
  }

  return true;
}
