import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createModifierGroup } from "../actions";
import Link from "next/link";

export default function NewModifierGroupPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-2xl bg-white p-4 shadow">
          <h1 className="text-2xl font-bold">Create Modifier Group</h1>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow">
          <form action={createModifierGroup} className="space-y-4">
            <div>
              <label
                htmlFor="modifier-group-name"
                className="mb-1 block text-sm font-medium"
              >
                Group Name
              </label>
              <Input
                id="modifier-group-name"
                name="name"
                placeholder="Group Name"
                required
                className="w-full border p-2 rounded"
              />
            </div>

            <div>
              <label
                htmlFor="modifier-group-min-select"
                className="mb-1 block text-sm font-medium"
              >
                Minimum selections
              </label>
              <Input
                id="modifier-group-min-select"
                name="minSelect"
                type="number"
                defaultValue={0}
                className="w-full border p-2 rounded"
              />
            </div>

            <div>
              <label
                htmlFor="modifier-group-max-select"
                className="mb-1 block text-sm font-medium"
              >
                Maximum selections
              </label>
              <Input
                id="modifier-group-max-select"
                name="maxSelect"
                type="number"
                defaultValue={1}
                className="w-full border p-2 rounded"
              />
            </div>

            <label htmlFor="modifier-group-active" className="flex gap-2">
              <Input
                id="modifier-group-active"
                type="checkbox"
                name="isActive"
                defaultChecked
              />
              Active
            </label>

            <div className="flex gap-3">
              <Button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Create
              </Button>

              <Link
                href="/admin/modifier-groups"
                className="border px-4 py-2 rounded"
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
