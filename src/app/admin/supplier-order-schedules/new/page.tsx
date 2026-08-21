import Link from "next/link";
import { AdminPage, Button } from "@/components/admin/shared";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SUPPLIER_ORDER_TIME_ZONE,
} from "@/lib/supplier-orders/scheduling";
import { createSupplierOrderSchedule } from "../actions";
import ScheduleForm from "../ScheduleForm";

export default async function NewSupplierOrderSchedulePage() {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const [suppliers, employees] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { notIn: ["CUSTOMER", "SUPPLIER"] } },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phoneNumber: true },
    }),
  ]);
  return (
    <AdminPage
      title="Create WhatsApp order schedule"
      description="Invite employees to select supplier items, then automatically combine and send one purchase order."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/supplier-order-schedules">Back to schedules</Link>
        </Button>
      }
    >
      <ScheduleForm
        action={createSupplierOrderSchedule}
        suppliers={suppliers}
        employees={employees.map((employee) => ({
          id: employee.id,
          name: employee.fullName,
          phone: employee.phoneNumber,
        }))}
        defaults={{
          name: "",
          supplierId: "",
          timeZone: DEFAULT_SUPPLIER_ORDER_TIME_ZONE,
          firstInviteAt: "",
          firstSupplierSendAt: "",
          reminderIntervalMinutes: 60,
          recurrenceUnit: "",
          recurrenceInterval: 1,
          endAt: "",
          deliveryLeadDays: 1,
          employeeIds: [],
        }}
      />
    </AdminPage>
  );
}
