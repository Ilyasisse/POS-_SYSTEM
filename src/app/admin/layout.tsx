import type { ReactNode } from "react";
import AdminShell from "@/components/admin/layout/AdminShell";
import { getPermissionsForRole, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const currentUser = await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  const [
    currentUser,
    [
      categoryCount,
      productCount,
      modifierCount,
      modifierGroupCount,
      staffCount,
      tableCount,
      openOrdersCount,
    ],
  ] = await Promise.all([
    requireRole(["ADMIN", "MANAGER"]),
    prisma.$transaction([
      prisma.category.count(),
      prisma.product.count(),
      prisma.modifier.count(),
      prisma.modifierGroup.count(),
      prisma.user.count({
        where: {
          role: {
            not: "CUSTOMER",
          },
        },
      }),
      prisma.table.count(),
      prisma.order.count({
        where: {
          status: "OPEN",
        },
      }),
    ]),
  ]);

  return (
    <AdminShell
      currentUser={{
        fullName: currentUser.fullName,
        role: currentUser.role,
        permissions: getPermissionsForRole(currentUser.role),
      }}
      counts={{
        categories: categoryCount,
        products: productCount,
        modifiers: modifierCount,
        modifierGroups: modifierGroupCount,
        staff: staffCount,
        tables: tableCount,
        orders: openOrdersCount,
      }}
    >
      {children}
    </AdminShell>
  );
}
