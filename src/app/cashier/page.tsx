import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/requireRole";
import SignOutButton from "../components/SignOutButton";
import {
  formatCashierBusinessDayRange,
  getCashierBusinessDayRange,
} from "@/lib/cashier-business-day";

type CashierPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function CashierPage({ searchParams }: CashierPageProps) {
  const currentUser = await requireRole(["CASHIER", "ADMIN"]);
  const params = await searchParams;
  const query = params?.q?.trim() || "";
  const { start: businessDayStart, end: businessDayEnd } =
    getCashierBusinessDayRange();
  const businessDayLabel = formatCashierBusinessDayRange(
    businessDayStart,
    businessDayEnd,
  );

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
            gte: businessDayStart,
            lt: businessDayEnd,
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
      0,
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
    (staff) => staff.totalOrders > 0 || query,
  );

  const grandTotalOrders = filteredSummaries.reduce(
    (sum, staff) => sum + staff.totalOrders,
    0,
  );

  const grandTotalSales = filteredSummaries.reduce(
    (sum, staff) => sum + staff.totalSales,
    0,
  );

  return (
    <main className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard-ka Cashier</h1>
          <p className="mt-2 text-lg text-slate-700">
            Welcome {currentUser.fullName}
          </p>
          <p className="text-sm text-slate-500">
            Maalinta cashier-ka: {businessDayLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/cashier/waiter-orders"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Dalabyada Waiter-ka
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Raadi magaca waiter..."
            className="w-full rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-blue-500"
          />

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Raadi
            </button>

            <a
              href="/cashier"
              className="rounded-xl border border-slate-300 px-4 py-2 hover:bg-slate-50"
            >
              Celi
            </a>
          </div>
        </form>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Shaqaale leh dalabyo</p>
          <h2 className="mt-2 text-2xl font-bold">
            {filteredSummaries.length}
          </h2>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Totalka Dalabyada</p>
          <h2 className="mt-2 text-2xl font-bold">{grandTotalOrders}</h2>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Totalka libka</p>
          <h2 className="mt-2 text-2xl font-bold">
            ${grandTotalSales.toFixed(2)}
          </h2>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filteredSummaries.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Dalab ma jiro</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Magac
                  </th>

                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Dalabyo
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    iibka
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredSummaries.map((staff) => (
                  <tr key={staff.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{staff.fullName}</td>
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
