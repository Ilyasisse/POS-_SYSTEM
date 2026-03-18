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
            <input
              name="name"
              placeholder="Group Name"
              required
              className="w-full border p-2 rounded"
            />

            <input
              name="minSelect"
              type="number"
              defaultValue={0}
              className="w-full border p-2 rounded"
            />

            <input
              name="maxSelect"
              type="number"
              defaultValue={1}
              className="w-full border p-2 rounded"
            />

            <label className="flex gap-2">
              <input type="checkbox" name="isActive" defaultChecked />
              Active
            </label>

            <div className="flex gap-3">
              <button className="bg-blue-600 text-white px-4 py-2 rounded">
                Create
              </button>

              <Link
                href="/admin/modifiers-groups"
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
