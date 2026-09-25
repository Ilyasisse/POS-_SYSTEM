import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { createCategory } from "../actions";
import { KITCHEN_STATIONS } from "@/lib/kitchen/kitchen-socket";

export default function NewCategoryPage() {
  return (
    <div
      className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Admin Dashboard
            </p>
            <h1 className="text-2xl font-bold">Create Category</h1>
          </div>

          <Link
            href="/admin/categories"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Back
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          <form action={createCategory} className="space-y-4">
            <div>
              <label
                htmlFor="new-category-name"
                className="mb-1 block text-sm font-medium"
              >
                Name
              </label>
              <Input
                id="new-category-name"
                name="name"
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Category name"
                required
              />
            </div>

            <div>
              <label
                htmlFor="new-category-station"
                className="mb-1 block text-sm font-medium"
              >
                Station
              </label>
              <NativeSelect
                id="new-category-station"
                name="station"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                defaultValue=""
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
              </NativeSelect>
            </div>

            <div>
              <label
                htmlFor="new-category-sort-order"
                className="mb-1 block text-sm font-medium"
              >
                Sort Order
              </label>
              <Input
                id="new-category-sort-order"
                name="sortOrder"
                type="number"
                defaultValue={0}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </div>

            <label
              htmlFor="new-category-active"
              className="flex items-center gap-2 text-md"
            >
              <Input
                id="new-category-active"
                name="isActive"
                type="checkbox"
                className="h-4 w-4 shrink-0"
                defaultChecked
              />
              Active
            </label>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Create Category
              </Button>

              <Link
                href="/admin/categories"
                className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50"
              >
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
