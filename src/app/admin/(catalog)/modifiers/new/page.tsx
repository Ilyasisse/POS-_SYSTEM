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
    <div
      className="bg-background text-foreground min-h-screen px-4 py-6 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="border-border bg-card flex items-center justify-between rounded-2xl border p-4 shadow-lg">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">
              Admin Dashboard
            </p>
            <h1 className="text-2xl font-bold">Create Modifier</h1>
          </div>

          <Link
            prefetch={false}
            href="/admin/modifiers"
            className="border-border hover:bg-card rounded-lg border px-4 py-2 text-sm"
          >
            Back
          </Link>
        </header>

        <section className="border-border bg-card rounded-2xl border p-6 shadow-lg">
          <form action={createModifier} className="space-y-4">
            <div>
              <label htmlFor="new-modifier-name" className="mb-1 block text-sm font-medium">
                Name
              </label>
              <Input
                id="new-modifier-name"
                name="name"
                type="text"
                className="border-border w-full rounded-lg border px-3 py-2"
                placeholder="Modifier name"
                required
              />
            </div>

            <div>
              <label htmlFor="new-modifier-price" className="mb-1 block text-sm font-medium">
                Price
              </label>
              <Input
                id="new-modifier-price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={0}
                className="border-border w-full rounded-lg border px-3 py-2"
                required
              />
            </div>

            <div>
              <label
                htmlFor="new-modifier-allergens"
                className="mb-1 block text-sm font-medium"
              >
                Allergen information (optional)
              </label>
              <textarea
                id="new-modifier-allergens"
                name="allergenInfo"
                maxLength={240}
                rows={3}
                placeholder="For example: Contains milk"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <p className="mt-1 text-xs text-slate-600">
                Verify ingredients and preparation practices with the kitchen.
                Blank does not mean allergen-free.
              </p>
            </div>

            <div>
              <p className="mb-2 block text-sm font-medium">Products</p>
              <div className="border-border max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">
                {products.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No products found.</p>
                ) : (
                  products.map((product) => (
                    <label
                      key={product.id}
                      className="text-md hover:bg-card flex items-center gap-2 rounded-md px-2 py-1"
                    >
                      <Input
                        name="productIds"
                        type="checkbox"
                        className="h-4 w-4 shrink-0"
                        value={product.id}
                      />
                      <span>{product.name}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                Select at least one product. One shared modifier with the same price will be created
                for all selected products.
              </p>
            </div>

            <div>
              <label htmlFor="new-modifier-group" className="mb-1 block text-sm font-medium">
                Modifier Group
              </label>
              <NativeSelect
                id="new-modifier-group"
                name="modifierGroupId"
                className="border-border w-full rounded-lg border px-3 py-2"
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

            <label htmlFor="new-modifier-active" className="text-md flex items-center gap-2">
              <Input
                id="new-modifier-active"
                name="isActive"
                type="checkbox"
                className="h-4 w-4 shrink-0"
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
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2"
              >
                Create Modifier
              </Button>

              <Link
                prefetch={false}
                href="/admin/modifiers"
                className="border-border hover:bg-card rounded-lg border px-4 py-2"
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
