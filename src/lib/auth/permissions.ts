import type { Station, UserRole } from "@prisma/client";

export const PERMISSIONS = {
  ADMIN_ACCESS: "admin.access",
  DASHBOARD_VIEW: "dashboard.view",
  CATALOG_MANAGE: "catalog.manage",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_MANAGE: "inventory.manage",
  INVENTORY_COST_MANAGE: "inventory.cost.manage",
  INVENTORY_COUNT_MANAGE: "inventory.count.manage",
  INVENTORY_COUNT_APPROVE: "inventory.count.approve",
  STAFF_MANAGE: "staff.manage",
  TABLE_MANAGE: "table.manage",
  TABLE_RESET_ASSIGNED: "table.reset.assigned",
  ORDER_VIEW_ALL: "order.view.all",
  ORDER_VIEW_ASSIGNED: "order.view.assigned",
  ORDER_CREATE: "order.create",
  ORDER_MANAGE: "order.manage",
  PAYMENT_TAKE: "payment.take",
  REPORT_VIEW: "report.view",
  REPORT_DAILY_VIEW: "report.daily.view",
  REPORT_WEEKLY_VIEW: "report.weekly.view",
  REPORT_MONTHLY_VIEW: "report.monthly.view",
  REPORT_FINANCIAL_VIEW: "report.financial.view",
  REPORT_STAFF_VIEW: "report.staff.view",
  REPORT_INVENTORY_VIEW: "report.inventory.view",
  REPORT_CUSTOMER_VIEW: "report.customer.view",
  REPORT_EXPORT: "report.export",
  ADJUSTMENT_OPERATIONAL_APPROVE: "adjustment.operational.approve",
  ADJUSTMENT_FINANCIAL_APPROVE: "adjustment.financial.approve",
  SETTINGS_MANAGE: "settings.manage",
  SUPPLIER_MANAGE: "supplier.manage",
  SUPPLY_MANAGE: "supply.manage",
  WAITER_BALANCE_ADMIN: "waiter.balance.admin",
  DAILY_CASH_MANAGE: "daily.cash.manage",
  KITCHEN_TICKET_VIEW: "kitchen.ticket.view",
  KITCHEN_TICKET_UPDATE: "kitchen.ticket.update",
  KITCHEN_TARGET_MANAGE: "kitchen.target.manage",
  KITCHEN_QUALITY_RECORD: "kitchen.quality.record",
  OPERATIONS_INCIDENT_RECORD: "operations.incident.record",
  OPERATIONS_INCIDENT_MANAGE: "operations.incident.manage",
  CLEANING_MANAGE: "cleaning.manage",
  CLEANING_COMPLETE: "cleaning.complete",
  CUSTOMER_ORDER: "customer.order",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

const ROLE_PERMISSIONS = {
  ADMIN: ALL_PERMISSIONS,
  MANAGER: [
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CATALOG_MANAGE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.INVENTORY_COUNT_MANAGE,
    PERMISSIONS.INVENTORY_COUNT_APPROVE,
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.TABLE_MANAGE,
    PERMISSIONS.ORDER_VIEW_ALL,
    PERMISSIONS.ORDER_MANAGE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_DAILY_VIEW,
    PERMISSIONS.REPORT_WEEKLY_VIEW,
    PERMISSIONS.REPORT_MONTHLY_VIEW,
    PERMISSIONS.REPORT_STAFF_VIEW,
    PERMISSIONS.REPORT_INVENTORY_VIEW,
    PERMISSIONS.REPORT_CUSTOMER_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.ADJUSTMENT_OPERATIONAL_APPROVE,
    PERMISSIONS.SUPPLIER_MANAGE,
    PERMISSIONS.KITCHEN_TARGET_MANAGE,
    PERMISSIONS.KITCHEN_QUALITY_RECORD,
    PERMISSIONS.OPERATIONS_INCIDENT_RECORD,
    PERMISSIONS.OPERATIONS_INCIDENT_MANAGE,
    PERMISSIONS.CLEANING_MANAGE,
    PERMISSIONS.CLEANING_COMPLETE,
  ],
  CASHIER: [
    PERMISSIONS.TABLE_MANAGE,
    PERMISSIONS.ORDER_VIEW_ALL,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_MANAGE,
    PERMISSIONS.PAYMENT_TAKE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_DAILY_VIEW,
    PERMISSIONS.OPERATIONS_INCIDENT_RECORD,
  ],
  WAITER: [PERMISSIONS.ORDER_VIEW_ASSIGNED, PERMISSIONS.ORDER_CREATE],
  COOK: [PERMISSIONS.KITCHEN_TICKET_VIEW, PERMISSIONS.KITCHEN_TICKET_UPDATE, PERMISSIONS.KITCHEN_QUALITY_RECORD, PERMISSIONS.OPERATIONS_INCIDENT_RECORD, PERMISSIONS.CLEANING_COMPLETE],
  BARISTA: [PERMISSIONS.KITCHEN_TICKET_VIEW, PERMISSIONS.KITCHEN_TICKET_UPDATE, PERMISSIONS.KITCHEN_QUALITY_RECORD, PERMISSIONS.OPERATIONS_INCIDENT_RECORD, PERMISSIONS.CLEANING_COMPLETE],
  Cabitaan: [
    PERMISSIONS.KITCHEN_TICKET_VIEW,
    PERMISSIONS.KITCHEN_TICKET_UPDATE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.KITCHEN_QUALITY_RECORD,
    PERMISSIONS.OPERATIONS_INCIDENT_RECORD,
    PERMISSIONS.CLEANING_COMPLETE,
  ],
  SUPPLIER: [],
  CLEANER: [PERMISSIONS.TABLE_RESET_ASSIGNED, PERMISSIONS.OPERATIONS_INCIDENT_RECORD, PERMISSIONS.CLEANING_COMPLETE],
  CUSTOMER: [PERMISSIONS.CUSTOMER_ORDER],
} as const satisfies Record<UserRole, readonly Permission[]>;

export type PermissionUser = {
  id: string;
  role: UserRole;
  station: Station | null;
};

export function hasPermission(
  user: Pick<PermissionUser, "role">,
  permission: Permission,
) {
  return (ROLE_PERMISSIONS[user.role] as readonly Permission[]).includes(
    permission,
  );
}

export function hasAnyPermission(
  user: Pick<PermissionUser, "role">,
  permissions: readonly Permission[],
) {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function getPermissionsForRole(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function getEffectiveStation(
  user: Pick<PermissionUser, "role" | "station">,
): Station | null {
  if (user.station) return user.station;
  if (user.role === "BARISTA") return "BARISTA";
  if (user.role === "Cabitaan") return "CABITAAN";
  return null;
}

export function canAccessStation(
  user: Pick<PermissionUser, "role" | "station">,
  allowedStations: readonly Station[],
) {
  if (user.role === "ADMIN") return true;
  const station = getEffectiveStation(user);
  return station !== null && allowedStations.includes(station);
}

export function canAccessOrder(
  user: PermissionUser,
  order: { waiterId: string | null; cashierId: string | null },
) {
  if (hasPermission(user, PERMISSIONS.ORDER_VIEW_ALL)) return true;
  return (
    hasPermission(user, PERMISSIONS.ORDER_VIEW_ASSIGNED) &&
    (order.waiterId === user.id || order.cashierId === user.id)
  );
}
