import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function ModifierGroupsPage() {
  const groups = await prisma.modifierGroup.findMany({
    orderBy: { name: "asc" },
  });

  const Today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const timeNow = new Date().toLocaleTimeString();

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

            <h1 className="text-2xl font-bold">Modifier Groups</h1>

            <p className="text-sm text-slate-500">
              Today: {Today}, {timeNow}
            </p>
          </div>

          <Link
            href="/admin/modifiers-groups/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            New Group
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <h2 className="text-lg font-bold text-slate-800">Groups</h2>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Min</th>
                  <th className="px-3 py-2 font-semibold">Max</th>
                  <th className="px-3 py-2 font-semibold">Active</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                </tr>
              </thead>

              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-700">
                      {group.name}
                    </td>

                    <td className="px-3 py-2">{group.minSelect}</td>

                    <td className="px-3 py-2">{group.maxSelect}</td>

                    <td className="px-3 py-2">
                      {group.isActive ? "Yes" : "No"}
                    </td>

                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/modifiers-groups/${group.id}`}
                        className="rounded-lg border px-3 py-1 hover:bg-slate-50"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
