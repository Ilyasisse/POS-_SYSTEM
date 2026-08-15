import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupplierOrderRunStatus } from "@prisma/client";
import {
  AdminPage,
  Button,
  DataTableCard,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { formatDateTimeLocal } from "@/lib/supplier-orders/scheduling";
import {
  retrySupplierOrderRun,
  toggleSupplierOrderSchedule,
  updateSupplierOrderSchedule,
} from "../actions";
import ScheduleForm from "../ScheduleForm";

function tone(status: SupplierOrderRunStatus) {
  if (status === "SENT") return "green" as const;
  if (status === "FAILED" || status === "CANCELLED") return "red" as const;
  if (status === "SKIPPED") return "slate" as const;
  if (status === "COLLECTING" || status === "FINALIZING") return "amber" as const;
  return "blue" as const;
}

export default async function SupplierOrderScheduleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ status?: string }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const [schedule, suppliers, employees] = await Promise.all([
    prisma.supplierOrderSchedule.findUnique({
      where: { id },
      include: {
        recipients: { select: { userId: true } },
        runs: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            recipients: { select: { status: true } },
            purchaseOrder: { select: { id: true, orderNumber: true } },
            deliveries: {
              where: { type: "SUPPLIER_ORDER" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { status: true },
            },
          },
        },
      },
    }),
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
  if (!schedule) notFound();
  const dateTime = new Intl.DateTimeFormat("en-US", {
    timeZone: schedule.timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  });
  const formInviteAt = schedule.nextInviteAt ?? schedule.firstInviteAt;
  const formSendAt = schedule.nextSupplierSendAt ?? schedule.firstSupplierSendAt;

  return (
    <AdminPage
      title={schedule.name}
      description="Edit future runs and review every employee response and supplier delivery."
      action={
        <>
          <form action={toggleSupplierOrderSchedule}>
            <input type="hidden" name="id" value={schedule.id} />
            <Button type="submit" variant={schedule.isActive ? "outline" : "default"}>
              {schedule.isActive ? "Pause schedule" : "Resume schedule"}
            </Button>
          </form>
          <Button asChild variant="outline">
            <Link href="/admin/supplier-order-schedules">Back to schedules</Link>
          </Button>
        </>
      }
    >
      {query.status ? (
        <Alert>
          <AlertTitle>Schedule saved</AlertTitle>
          <AlertDescription>
            Existing runs were left unchanged; the updated settings apply to future runs.
          </AlertDescription>
        </Alert>
      ) : null}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Run history</h2>
        <DataTableCard>
          <Table>
            <thead>
              <tr>
                <TableHead>Run</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Responses</TableHead>
                <TableHead>Purchase order</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Status</TableHead>
              </tr>
            </thead>
            <tbody>
              {schedule.runs.length ? schedule.runs.map((run) => {
                const responded = run.recipients.filter((recipient) => recipient.status === "RESPONDED").length;
                const noOrder = run.recipients.filter((recipient) => recipient.status === "NO_ORDER").length;
                const pending = run.recipients.length - responded - noOrder;
                return (
                  <tr key={run.id} className="border-t align-top">
                    <TableCell className="font-semibold">#{run.sequence}</TableCell>
                    <TableCell>
                      <div>{dateTime.format(run.inviteAt)}</div>
                      <div className="text-xs text-muted-foreground">to {dateTime.format(run.supplierSendAt)}</div>
                    </TableCell>
                    <TableCell>
                      <div>{responded} ordered · {noOrder} no order</div>
                      <div className="text-xs text-muted-foreground">{pending} missed deadline / pending</div>
                    </TableCell>
                    <TableCell>
                      {run.purchaseOrder ? (
                        <Link className="font-semibold text-primary hover:underline" href={`/admin/supplier-purchase-orders/${run.purchaseOrder.id}`}>
                          PO #{run.purchaseOrder.orderNumber}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{run.deliveries[0]?.status ?? "—"}</TableCell>
                    <TableCell>
                      <ToneBadge tone={tone(run.status)}>{run.status}</ToneBadge>
                      {run.failureReason ? <p className="mt-1 max-w-64 text-xs text-destructive">{run.failureReason}</p> : null}
                      {run.status === "FAILED" ? (
                        <form action={retrySupplierOrderRun} className="mt-2">
                          <input type="hidden" name="runId" value={run.id} />
                          <Button type="submit" size="sm" variant="outline">Retry</Button>
                        </form>
                      ) : null}
                    </TableCell>
                  </tr>
                );
              }) : (
                <tr><TableCell colSpan={6}>No runs have started yet.</TableCell></tr>
              )}
            </tbody>
          </Table>
        </DataTableCard>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Future schedule settings</h2>
        <ScheduleForm
          action={updateSupplierOrderSchedule}
          suppliers={suppliers}
          employees={employees.map((employee) => ({ id: employee.id, name: employee.fullName, phone: employee.phoneNumber }))}
          defaults={{
            id: schedule.id,
            name: schedule.name,
            supplierId: schedule.supplierId,
            timeZone: schedule.timeZone,
            firstInviteAt: formatDateTimeLocal(formInviteAt, schedule.timeZone),
            firstSupplierSendAt: formatDateTimeLocal(formSendAt, schedule.timeZone),
            reminderIntervalMinutes: schedule.reminderIntervalMinutes,
            recurrenceUnit: schedule.recurrenceUnit ?? "",
            recurrenceInterval: schedule.recurrenceInterval,
            endAt: schedule.endAt ? formatDateTimeLocal(schedule.endAt, schedule.timeZone) : "",
            deliveryLeadDays: schedule.deliveryLeadDays,
            employeeIds: schedule.recipients.map((recipient) => recipient.userId),
          }}
        />
      </section>
    </AdminPage>
  );
}
