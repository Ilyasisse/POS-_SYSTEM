import Link from "next/link";
import {
  AdminPage,
  Button,
  DataTableCard,
  MetricCard,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { ToastOnMount } from "@/components/ui/toast";

const dateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "Africa/Nairobi",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function SupplierOrderSchedulesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const query = (await searchParams) ?? {};
  const schedules = await prisma.supplierOrderSchedule.findMany({
    where: { deletedAt: null },
    include: {
      supplier: { select: { name: true } },
      _count: { select: { recipients: true, runs: true } },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const active = schedules.filter((schedule) => schedule.isActive).length;
  const failed = schedules.filter((schedule) => schedule.runs[0]?.status === "FAILED").length;
  return (
    <AdminPage
      title="WhatsApp supplier ordering"
      description="Schedule employee requests, reminders, combined purchase orders, and supplier delivery."
      action={
        <>
          <Button asChild>
            <Link prefetch={false} href="/admin/supplier-order-schedules/new">
              Create schedule
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link prefetch={false} href="/admin/supplier-purchase-orders">
              Purchase orders
            </Link>
          </Button>
        </>
      }
    >
      {query.status === "deleted" ? (
        <ToastOnMount
          tone="success"
          title="Schedule deleted"
          description="Future processing was stopped. Existing purchase orders and WhatsApp history were preserved."
        />
      ) : null}
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Schedules" value={schedules.length} />
        <MetricCard label="Active" value={active} />
        <MetricCard label="Latest run failed" value={failed} />
      </section>
      <DataTableCard>
        <Table data-supplier-cards>
          <thead>
            <tr>
              <TableHead>Schedule</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead>Next invitation</TableHead>
              <TableHead>Recurrence</TableHead>
              <TableHead>Status</TableHead>
            </tr>
          </thead>
          <tbody>
            {schedules.length ? (
              schedules.map((schedule) => (
                <tr key={schedule.id} className="border-t">
                  <TableCell data-label="Schedule">
                    <Link
                      prefetch={false}
                      href={`/admin/supplier-order-schedules/${schedule.id}`}
                      className="text-primary font-semibold hover:underline"
                    >
                      {schedule.name}
                    </Link>
                    <div className="text-muted-foreground text-xs">{schedule._count.runs} runs</div>
                  </TableCell>
                  <TableCell data-label="Supplier">{schedule.supplier.name}</TableCell>
                  <TableCell data-label="Employees">{schedule._count.recipients}</TableCell>
                  <TableCell data-label="Next invitation">
                    {schedule.nextInviteAt ? dateTime.format(schedule.nextInviteAt) : "Complete"}
                  </TableCell>
                  <TableCell data-label="Recurrence">
                    {schedule.recurrenceUnit
                      ? `Every ${schedule.recurrenceInterval} ${schedule.recurrenceUnit.toLowerCase()}${schedule.recurrenceInterval === 1 ? "" : "s"}`
                      : "One time"}
                  </TableCell>
                  <TableCell data-label="Status">
                    {schedule.runs[0]?.status === "FAILED" ? (
                      <div>
                        <ToneBadge tone="red">Latest run failed</ToneBadge>
                        <Link
                          className="ml-2 underline"
                          href={`/admin/supplier-order-schedules/${schedule.id}`}
                        >
                          Review run →
                        </Link>
                      </div>
                    ) : null}
                    <ToneBadge tone={schedule.isActive ? "green" : "slate"}>
                      {schedule.isActive ? "ACTIVE" : "PAUSED / COMPLETE"}
                    </ToneBadge>
                  </TableCell>
                </tr>
              ))
            ) : (
              <tr>
                <TableCell colSpan={6}>
                  No WhatsApp supplier order schedules have been created.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
