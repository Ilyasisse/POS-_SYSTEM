import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createModifier } from "../actions";
import PronunciationRecorder from "@/components/admin/pronunciations/PronunciationRecorder";

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
              <label
                htmlFor="new-modifier-name"
                className="mb-1 block text-sm font-medium"
              >
                Name
              </label>
              <Input
                id="new-modifier-name"
                name="name"
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Modifier name"
                required
              />
            </div>

            <div>
              <label
                htmlFor="new-modifier-price"
                className="mb-1 block text-sm font-medium"
              >
                Price
              </label>
              <Input
                id="new-modifier-price"
                name="price"
                type="number"
                step="0.01"
                defaultValue={0}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </div>

            <div>
              <p className="mb-2 block text-sm font-medium">Products</p>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-300 p-3">
                {products.length === 0 ? (
                  <p className="text-sm text-slate-500">No products found.</p>
                ) : (
                  products.map((product) => (
                    <label
                      key={product.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                    >
                      <Input
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
              <label
                htmlFor="new-modifier-group"
                className="mb-1 block text-sm font-medium"
              >
                Modifier Group
              </label>
              <NativeSelect
                id="new-modifier-group"
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
              </NativeSelect>
            </div>

            <label
              htmlFor="new-modifier-active"
              className="flex items-center gap-2 text-sm"
            >
              <Input
                id="new-modifier-active"
                name="isActive"
                type="checkbox"
                defaultChecked
              />
              Active
            </label>

            <PronunciationRecorder
              inputName="pronunciationAudioUrl"
              entityType="modifier"
              label="Modifier pronunciation"
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Create Modifier
              </Button>

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
