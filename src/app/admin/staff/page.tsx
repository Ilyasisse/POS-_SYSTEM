import {
  AdminPageFrame,
  AdminSearchToolbar,
  AdminSelect,
  AdminStatCard,
  AdminTable,
  AdminTableShell,
  AdminTd,
  AdminTh,
  StatusBadge,
} from "@/components/admin/AdminUi";
import { prisma } from "@/lib/prisma";

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
  const staff = userRows
    .filter((member) => member.role !== "CUSTOMER")
    .filter((member) => {
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
  const roles = [...new Set(allStaff.map((member) => member.role))].sort();

  return (
    <AdminPageFrame
      title="Staff"
      description="Manage staff members and their roles"
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <AdminStatCard label="Total Staff" value={allStaff.length} />
        <AdminStatCard label="Active Accounts" value={activeStaff} />
        <AdminStatCard label="Kitchen Team" value={kitchenStaff} />
      </section>

      <AdminTableShell
        footer={
          <p className="text-sm font-medium text-slate-500">
            Showing 1 to {staff.length} of {allStaff.length} staff
          </p>
        }
      >
        <AdminSearchToolbar
          placeholder="Search staff..."
          defaultValue={params?.q ?? ""}
        >
          <AdminSelect name="role" defaultValue={role}>
            <option value="all">Role All</option>
            {roles.map((item) => (
              <option key={item} value={item}>
                {formatRole(item)}
              </option>
            ))}
          </AdminSelect>
          <AdminSelect name="status" defaultValue={status}>
            <option value="all">Status All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </AdminSelect>
          <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">
            Filter
          </button>
        </AdminSearchToolbar>
        <AdminTable>
          <thead>
            <tr>
              <AdminTh>#</AdminTh>
              <AdminTh>Name</AdminTh>
              <AdminTh>Role</AdminTh>
              <AdminTh>Phone</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Joined On</AdminTh>
              <AdminTh>Activity</AdminTh>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <AdminTd colSpan={7} className="py-10 text-center">
                  No staff accounts found.
                </AdminTd>
              </tr>
            ) : (
              staff.map((member, index) => (
                <tr key={member.id} className="border-b border-slate-50">
                  <AdminTd className="font-bold text-slate-400">
                    {index + 1}
                  </AdminTd>
                  <AdminTd className="font-black text-slate-950">
                    <div>{member.fullName}</div>
                    <div className="text-xs font-medium text-slate-400">
                      {member.email}
                    </div>
                  </AdminTd>
                  <AdminTd>{formatRole(member.role)}</AdminTd>
                  <AdminTd>{member.phoneNumber ?? "-"}</AdminTd>
                  <AdminTd>
                    <StatusBadge active={member.isActive} />
                  </AdminTd>
                  <AdminTd>
                    {member.createdAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </AdminTd>
                  <AdminTd>
                    {member._count.waiterOrders + member._count.orders} orders
                  </AdminTd>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>
      </AdminTableShell>
    </AdminPageFrame>
  );
}
