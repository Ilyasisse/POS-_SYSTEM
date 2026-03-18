import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/requireRole";
import RefreshButton from "@/app/components/RefreshButton";

type CashierPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function CashierPage({
  searchParams,
}: CashierPageProps) {
  const currentUser = await requireRole(["CASHIER", "ADMIN"]);
  const params = await searchParams;
  const query = params?.q?.trim() || "";

  // Today's date range
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const staffWithOrders = await prisma.user.findMany({
    where: {
      role: {
        in: ["WAITER"],
      },

      ...(query
        ? {
            fullName: {
              contains: query,
              mode: "insensitive",
            },
          }
        : {}),
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      orders: {
        where: {
          createdAt: {
            gte: startOfToday,
            lt: startOfTomorrow,
          },
        },
        select: {
          id: true,
          total: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      fullName: "asc",
    },
  });

  const summaries = staffWithOrders.map((staff) => {
    const totalOrders = staff.orders.length;
    const totalSales = staff.orders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    );

    return {
      id: staff.id,
      fullName: staff.fullName,
      email: staff.email,
      role: staff.role,
      totalOrders,
      totalSales,
    };
  });

  const filteredSummaries = summaries.filter(
    (staff) => staff.totalOrders > 0 || query
  );

  const grandTotalOrders = filteredSummaries.reduce(
    (sum, staff) => sum + staff.totalOrders,
    0
  );

  const grandTotalSales = filteredSummaries.reduce(
    (sum, staff) => sum + staff.totalSales,
    0
  );

  return (
    <main className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cashier Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            Logged in as {currentUser.fullName}
          </p>
          <p className="text-sm text-slate-500">
            Showing orders for today only
          </p>
        </div>

        <RefreshButton />
      </div>

    
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by waiter name..."
            className="w-full rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-blue-500"
          />

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Search
            </button>

            <a
              href="/cashier"
              className="rounded-xl border border-slate-300 px-4 py-2 hover:bg-slate-50"
            >
              Reset
            </a>
          </div>
        </form>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Staff With Orders Today</p>
          <h2 className="mt-2 text-2xl font-bold">
            {filteredSummaries.length}
          </h2>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Orders Today</p>
          <h2 className="mt-2 text-2xl font-bold">{grandTotalOrders}</h2>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Sales Today</p>
          <h2 className="mt-2 text-2xl font-bold">
            ${grandTotalSales.toFixed(2)}
          </h2>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Today’s Orders By Staff</h2>
        </div>

        {filteredSummaries.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No orders found for today.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Name
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Role
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Email
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Orders Today
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Sales Today
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredSummaries.map((staff) => (
                  <tr key={staff.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{staff.fullName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {staff.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {staff.email || "-"}
                    </td>
                    <td className="px-4 py-3">{staff.totalOrders}</td>
                    <td className="px-4 py-3">
                      ${staff.totalSales.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}