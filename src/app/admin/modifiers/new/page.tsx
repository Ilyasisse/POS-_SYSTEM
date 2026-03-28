import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createModifier } from "../actions";
import PronunciationRecorder from "@/app/components/admin/PronunciationRecorder";

export default async function NewModifierPage() {
  const [products, modifierGroups] = await Promise.all([
    prisma.product.findMany({
      orderBy: {
        name: "asc",
      },
    }),
    prisma.modifierGroup.findMany({
      orderBy: {
        name: "asc",
      },
    }),
  ]);

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
            <h1 className="text-2xl font-bold">Create Modifier</h1>
          </div>

          <Link
            href="/admin/modifiers"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Back
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          <form action={createModifier} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                name="name"
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Modifier name"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Price</label>
              <input
                name="price"
                type="number"
                step="0.01"
                defaultValue={0}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Products</label>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-300 p-3">
                {products.length === 0 ? (
                  <p className="text-sm text-slate-500">No products found.</p>
                ) : (
                  products.map((product) => (
                    <label
                      key={product.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                    >
                      <input
                        name="productIds"
                        type="checkbox"
                        value={product.id}
                      />
                      <span className="text-sm">{product.name}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                You can select multiple products.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Modifier Group
              </label>
              <select
                name="modifierGroupId"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select modifier group
                </option>
                {modifierGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input name="isActive" type="checkbox" defaultChecked />
              Active
            </label>

            <PronunciationRecorder
              inputName="pronunciationAudioUrl"
              entityType="modifier"
              label="Modifier pronunciation"
            />

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Create Modifier
              </button>

              <Link
                href="/admin/modifiers"
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
