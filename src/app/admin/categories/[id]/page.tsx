import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteCategory, updateCategory } from "../actions";
import { KITCHEN_STATIONS } from "@/lib/kitchen/kitchen-socket";

type CategoryDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CategoryDetailsPage({
  params,
}: CategoryDetailsPageProps) {
  const { id } = await params;

  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    notFound();
  }

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Admin Dashboard
            </p>
            <h1 className="text-2xl font-bold">Category Details</h1>
            <p className="text-sm text-slate-500">{category.name}</p>
          </div>

          <Link
            href="/admin/categories"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Back
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-bold text-slate-800">
            Edit Category
          </h2>

          <form action={updateCategory} className="space-y-4">
            <input type="hidden" name="id" value={category.id} />

            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                name="name"
                type="text"
                defaultValue={category.name}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Station</label>
              <select
                name="station"
                defaultValue={category.station ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              >
                <option value="" disabled>
                  Select station
                </option>
                {KITCHEN_STATIONS.map((station) => (
                  <option key={station} value={station}>
                    {station}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Sort Order
              </label>
              <input
                name="sortOrder"
                type="number"
                defaultValue={category.sortOrder}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={category.isActive}
              />
              Active
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-bold text-red-600">
            Delete Category
          </h2>

          <p className="mb-4 text-sm text-slate-600">
            This will permanently delete{" "}
            <span className="font-semibold">{category.name}</span>.
          </p>

          <form action={deleteCategory}>
            <input type="hidden" name="id" value={category.id} />
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Delete Category
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
