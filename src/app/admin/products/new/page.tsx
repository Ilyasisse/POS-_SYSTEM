import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
  });

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
            <h1 className="text-2xl font-bold">Create Product</h1>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          <form action={createProduct} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                name="name"
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Product name"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Price</label>
              <input
                name="price"
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Category</label>
              <select
                name="categoryId"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select category
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input name="trackStock" type="checkbox" />
              Track Stock
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Create Product
              </button>

              <Link
                href="/admin/products"
                className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50"
              >
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
