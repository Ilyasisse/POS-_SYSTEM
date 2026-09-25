import Link from "next/link";
import { AdminPage, Card } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToastOnMount } from "@/components/ui/toast";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  assignComplaintAction,
  createComplaintAction,
  resolveComplaintAction,
} from "./actions";

export const dynamic = "force-dynamic";
const noticeText: Record<string, string> = {
  created: "Complaint recorded.",
  assigned: "Complaint assigned.",
  resolved: "Complaint resolved.",
};

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; page?: string; notice?: string }>;
}) {
  await requirePermission(PERMISSIONS.COMPLAINT_MANAGE);
  const params = await searchParams;
  const closed = params?.status === "resolved";
  const requested = Number(params?.page ?? "1");
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, 10000)
      : 1;
  const where = {
    status: closed
      ? { in: ["RESOLVED", "CLOSED"] as ("RESOLVED" | "CLOSED")[] }
      : { in: ["OPEN", "IN_PROGRESS"] as ("OPEN" | "IN_PROGRESS")[] },
  };
  const [cases, total, staff] = await Promise.all([
    prisma.complaintCase.findMany({
      where,
      include: {
        order: { select: { orderNumber: true } },
        assignedTo: { select: { fullName: true } },
        resolvedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 25,
      take: 25,
    }),
    prisma.complaintCase.count({ where }),
    prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <AdminPage
      title="Customer complaints"
      description="Track service recovery, ownership, and resolution notes."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/operations">Operations</Link>
        </Button>
      }
    >
      {params?.notice && noticeText[params.notice] ? (
        <ToastOnMount tone="success" description={noticeText[params.notice]} />
      ) : null}
      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-bold">Record a complaint</h2>
        <form
          action={createComplaintAction}
          className="grid gap-3 sm:grid-cols-2"
        >
          <label className="text-sm">
            Category
            <select
              name="category"
              className="mt-1 h-10 w-full rounded-md border px-3"
            >
              <option value="SERVICE">Service</option>
              <option value="FOOD">Food</option>
              <option value="PAYMENT">Payment</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="text-sm">
            Priority
            <select
              name="priority"
              className="mt-1 h-10 w-full rounded-md border px-3"
            >
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>
          <label className="text-sm">
            Order number (optional)
            <Input
              name="orderNumber"
              type="number"
              min={1}
              step={1}
              className="mt-1"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            What happened?
            <textarea
              name="description"
              minLength={10}
              maxLength={2000}
              required
              className="mt-1 min-h-24 w-full rounded-md border p-3"
            />
          </label>
          <Button className="sm:w-fit">Record complaint</Button>
        </form>
      </Card>
      <nav className="flex gap-2" aria-label="Complaint status">
        <Button asChild variant={closed ? "outline" : "default"}>
          <Link href="/admin/operations/complaints">Open</Link>
        </Button>
        <Button asChild variant={closed ? "default" : "outline"}>
          <Link href="/admin/operations/complaints?status=resolved">
            Resolved / closed
          </Link>
        </Button>
      </nav>
      <p className="text-sm text-muted-foreground">
        {total} {closed ? "resolved or closed" : "open"} case(s). Showing page{" "}
        {page}.
      </p>
      {cases.length ? (
        cases.map((item) => (
          <Card key={item.id} className="space-y-3 p-5">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-bold">
                {item.category} · {item.priority} · {item.status}
              </h2>
              <span className="text-sm text-muted-foreground">
                {item.createdAt.toLocaleString("en-US", {
                  timeZone: "Africa/Nairobi",
                })}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{item.description}</p>
            <p className="text-sm text-muted-foreground">
              {item.order ? `Order #${item.order.orderNumber} · ` : ""}
              {item.assignedTo
                ? `Assigned to ${item.assignedTo.fullName}`
                : "Unassigned"}
            </p>
            {closed ? (
              <p className="text-sm">
                Resolution: {item.resolutionNotes} ·{" "}
                {item.resolvedBy?.fullName ?? "Staff"}
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                <form
                  action={assignComplaintAction}
                  className="flex flex-wrap gap-2"
                >
                  <input type="hidden" name="complaintId" value={item.id} />
                  <select
                    name="assigneeId"
                    aria-label="Assign complaint"
                    defaultValue={item.assignedToUserId ?? ""}
                    required
                    className="h-10 min-w-40 rounded-md border px-2"
                  >
                    <option value="">Select staff</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.fullName}
                      </option>
                    ))}
                  </select>
                  <Button variant="outline">Assign</Button>
                </form>
                <form
                  action={resolveComplaintAction}
                  className="flex flex-wrap gap-2"
                >
                  <input type="hidden" name="complaintId" value={item.id} />
                  <Input
                    name="resolutionNotes"
                    placeholder="Resolution (10+ characters)"
                    minLength={10}
                    maxLength={2000}
                    required
                    className="min-w-48 flex-1"
                  />
                  <Button>Resolve</Button>
                </form>
              </div>
            )}
          </Card>
        ))
      ) : (
        <Card className="p-5">No complaints in this view.</Card>
      )}
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline">
            <Link
              href={`?status=${closed ? "resolved" : "open"}&page=${page - 1}`}
            >
              Previous
            </Link>
          </Button>
        ) : null}
        {page * 25 < total ? (
          <Button asChild variant="outline">
            <Link
              href={`?status=${closed ? "resolved" : "open"}&page=${page + 1}`}
            >
              Next
            </Link>
          </Button>
        ) : null}
      </div>
    </AdminPage>
  );
}
