import type { ReactNode } from "react";
import StaffShell from "@/components/staff/StaffShell";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/prisma";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
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
    <StaffShell
      currentUser={{
        fullName: currentUser.fullName,
        email: currentUser.email,
        role: currentUser.role,
        station: currentUser.station,
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
    </StaffShell>
  );
}
