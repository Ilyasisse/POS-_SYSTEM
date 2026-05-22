import { prisma } from "@/lib/prisma";

function formatRole(role: string) {
  return role === "Cabitaan" ? "CABITAAN" : role;
}

export default async function StaffPage() {
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
  const staff = userRows.filter((member) => member.role !== "CUSTOMER");

  const activeStaff = staff.filter((member) => member.isActive).length;
  const kitchenStaff = staff.filter((member) =>
    ["COOK", "BARISTA", "Cabitaan"].includes(member.role)
  ).length;

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-24">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Admin Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-bold">Staff</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review staff accounts, roles, work stations, and operational
            activity.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Total Staff</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {staff.length}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Active Accounts</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {activeStaff}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-500">Kitchen Team</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {kitchenStaff}
            </h2>
          </div>

        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">Team Directory</h2>
            <p className="text-sm text-slate-500">{staff.length} staff records</p>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Station</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Waiter Orders</th>
                  <th className="px-3 py-2 font-semibold">Cashier Orders</th>
                  <th className="px-3 py-2 font-semibold">Shifts</th>
                </tr>
              </thead>

              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-slate-500"
                    >
                      No staff accounts found.
                    </td>
                  </tr>
                ) : (
                  staff.map((member) => (
                    <tr key={member.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-700">
                        {member.fullName}
                      </td>
                      <td className="px-3 py-2">{member.email}</td>
                      <td className="px-3 py-2">{formatRole(member.role)}</td>
                      <td className="px-3 py-2">{member.station ?? "-"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            member.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {member.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {member._count.waiterOrders}
                      </td>
                      <td className="px-3 py-2">{member._count.orders}</td>
                      <td className="px-3 py-2">{member._count.shifts}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
