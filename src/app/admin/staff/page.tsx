import { Button } from "@/components/ui/button";
import {
  AdminPage,
  SearchToolbar,
  NativeSelect,
  MetricCard,
  Table,
  DataTableCard,
  TableCell,
  TableHead,
  StatusBadge,
} from "@/components/admin/shared";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card } from "@/components/ui/card";

type StaffPageProps = {
  searchParams?: Promise<{
    q?: string;
    role?: string;
    status?: string;
  }>;
};

function formatRole(role: string) {
  return role === "Cabitaan" ? "CABITAAN" : role;
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const params = await searchParams;
  const q = params?.q?.trim().toLowerCase() ?? "";
  const role = params?.role ?? "all";
  const status = params?.status ?? "all";
  const userRows = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
    include: {
      _count: {
        select: {
          waiterOrders: true,
          orders: true,
          shifts: true,
        },
      },
    },
  });
  const staff = userRows.filter((member) => {
    if (member.role === "CUSTOMER") {
      return false;
    }

    const matchesSearch =
      !q ||
      member.fullName.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q);
    const matchesRole = role === "all" || member.role === role;
    const matchesStatus =
      status === "all" ||
      (status === "active" ? member.isActive : !member.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const allStaff = userRows.filter((member) => member.role !== "CUSTOMER");
  const activeStaff = allStaff.filter((member) => member.isActive).length;
  const kitchenStaff = allStaff.filter((member) =>
    ["COOK", "BARISTA", "Cabitaan"].includes(member.role),
  ).length;
  const roles = Array.from(
    new Set(allStaff.map((member) => member.role)),
  ).toSorted();

  return (
    <AdminPage title="Staff" description="Manage staff members and their roles">
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total Staff" value={allStaff.length} />
        <MetricCard label="Active Accounts" value={activeStaff} />
        <MetricCard label="Kitchen Team" value={kitchenStaff} />
      </section>

      <section aria-label="Staff administration" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Employment", "Compensation profiles and effective dates", "/admin/staff/employment"],
          ["Schedules", "Plan station shifts and prevent conflicts", "/admin/staff/schedules"],
          ["Attendance", "Approve attendance, lateness and overtime", "/admin/staff/attendance"],
          ["Payroll", "Preview, approve and finalize payroll", "/admin/staff/payroll"],
        ].map(([title, description, href]) => (
          <Card className="p-5" key={href}>
            <h2 className="font-bold">{title}</h2>
            <p className="mt-1 min-h-10 text-sm text-slate-500">{description}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href={href}>Open {title}</Link>
            </Button>
          </Card>
        ))}
      </section>

      <DataTableCard
        footer={
          <p className="text-sm font-medium text-slate-500">
            Showing 1 to {staff.length} of {allStaff.length} staff
          </p>
        }
      >
        <SearchToolbar
          placeholder="Search staff..."
          defaultValue={params?.q ?? ""}
        >
          <NativeSelect name="role" defaultValue={role}>
            <option value="all">Role All</option>
            {roles.map((item) => (
              <option key={item} value={item}>
                {formatRole(item)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="status" defaultValue={status}>
            <option value="all">Status All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </NativeSelect>
          <Button
            type="submit"
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-white"
          >
            Filter
          </Button>
        </SearchToolbar>
        <Table>
          <thead>
            <tr>
              <TableHead>#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined On</TableHead>
              <TableHead>Activity</TableHead>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <TableCell colSpan={7} className="py-10 text-center">
                  No staff accounts found.
                </TableCell>
              </tr>
            ) : (
              staff.map((member, index) => (
                <tr key={member.id} className="border-b border-slate-50">
                  <TableCell className="font-bold text-slate-400">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-black text-slate-950">
                    <div>{member.fullName}</div>
                    <div className="text-xs font-medium text-slate-400">
                      {member.email}
                    </div>
                  </TableCell>
                  <TableCell>{formatRole(member.role)}</TableCell>
                  <TableCell>{member.phoneNumber ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge active={member.isActive} />
                  </TableCell>
                  <TableCell>
                    {member.createdAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    {member._count.waiterOrders + member._count.orders} orders
                  </TableCell>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
