import Link from "next/link";
import { prisma } from "@/lib/prisma";

type AdminModifiersPageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

export default async function AdminModifiersPage({
  searchParams,
}: AdminModifiersPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(Number(params.page) || 1, 1);
  const pageSize = 15;
  const skip = (currentPage - 1) * pageSize;

  const [modifiersList, totalModifiers] = await Promise.all([
    prisma.modifier.findMany({
      skip,
      take: pageSize,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        product: true,
        modifierGroup: true,
      },
    }),
    prisma.modifier.count(),
  ]);

  const totalPages = Math.max(Math.ceil(totalModifiers / pageSize), 1);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const timeNow = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Admin Dashboard
            </p>
            <h1 className="text-2xl font-bold">Modifier List</h1>
            <p className="text-sm text-slate-500">
              Today: {today}, {timeNow}
            </p>
          </div>

          <Link
            href="/admin/modifiers/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            New Modifier
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">By Modifier</h2>
            <p className="text-sm text-slate-500">
              Page {currentPage} of {totalPages}
            </p>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Price</th>
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 font-semibold">Group</th>
                  <th className="px-3 py-2 font-semibold">Active</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody>
                {modifiersList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-slate-500"
                    >
                      No modifiers found.
                    </td>
                  </tr>
                ) : (
                  modifiersList.map((modifier) => (
                    <tr key={modifier.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-700">
                        {modifier.name}
                      </td>

                      <td className="px-3 py-2">
                        ${Number(modifier.price).toFixed(2)}
                      </td>

                      <td className="px-3 py-2">
                        {modifier.product?.name ?? "-"}
                      </td>

                      <td className="px-3 py-2">
                        {modifier.modifierGroup?.name ?? "-"}
                      </td>

                      <td className="px-3 py-2 font-bold text-[#2E7D32]">
                        {modifier.isActive ? "Yes" : "No"}
                      </td>

                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/modifiers/${modifier.id}`}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Link
              href={`?page=${currentPage - 1}`}
              className={`rounded-lg border px-4 py-2 text-sm ${
                currentPage <= 1
                  ? "pointer-events-none opacity-50"
                  : "hover:bg-slate-50"
              }`}
            >
              Previous
            </Link>

            <span className="text-sm text-slate-500">
              {totalModifiers} total modifiers
            </span>

            <Link
              href={`?page=${currentPage + 1}`}
              className={`rounded-lg border px-4 py-2 text-sm ${
                currentPage >= totalPages
                  ? "pointer-events-none opacity-50"
                  : "hover:bg-slate-50"
              }`}
            >
              Next
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}