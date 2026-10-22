import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { createCategory } from "../actions";
import { KITCHEN_STATIONS } from "@/lib/kitchen/kitchen-socket";

export default function NewCategoryPage() {
  return (
    <div
      className="min-h-screen bg-background px-4 py-6 text-foreground md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Admin Dashboard
            </p>
            <h1 className="text-2xl font-bold">Create Category</h1>
          </div>

          <Link
            prefetch={false}
            href="/admin/categories"
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-card"
          >
            Back
          </Link>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-lg">
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
                className="w-full rounded-lg border border-border px-3 py-2"
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
                className="w-full rounded-lg border border-border px-3 py-2"
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
                className="w-full rounded-lg border border-border px-3 py-2"
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
                className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
              >
                Create Category
              </Button>

              <Link
                prefetch={false}
                href="/admin/categories"
                className="rounded-lg border border-border px-4 py-2 hover:bg-card"
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
