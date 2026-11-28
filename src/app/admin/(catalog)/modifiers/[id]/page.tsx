import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole as requireAuth } from "@/lib/auth/require-role";
import { deleteModifier, updateModifier } from "../actions";
import { DeleteCatalogItemSection } from "../../DeleteCatalogItemSection";
import PronunciationRecorder from "@/components/admin/pronunciations/PronunciationRecorder";

type ModifierDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ModifierDetailsPage({ params }: ModifierDetailsPageProps) {
  // Params can resolve with auth; modifier reads still need the resolved id.
  const [resolvedParams] = await Promise.all([params, requireAuth(["ADMIN", "MANAGER"])]);
  const id = resolvedParams.id;

  const [modifierUnique, products, modifierGroups] = await Promise.all([
    prisma.modifier.findUnique({
      where: { id },
      include: {
        products: { select: { id: true } },
        modifierGroup: true,
      },
    }),
    prisma.product.findMany({
      orderBy: {
        name: "asc",
      },
    }),
    prisma.modifierGroup.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  if (!modifierUnique) {
    notFound();
  }

  return (
    <div
      className="bg-background text-foreground min-h-screen px-4 py-6 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="border-border bg-card flex items-center justify-between rounded-2xl border p-4 shadow-lg">
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
              Admin Dashboard
            </p>
            <h1 className="text-2xl font-bold">Modifier Details</h1>
            <p className="text-muted-foreground text-sm">{modifierUnique.name}</p>
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
          <h2 className="text-foreground mb-4 text-lg font-bold">Edit Modifier</h2>

          <form action={updateModifier} className="space-y-4">
            <Input type="hidden" name="id" value={modifierUnique.id} />
            <p className="text-muted-foreground text-sm">
              Changes to this modifier, including its price and active status, apply to every linked
              product.
            </p>

            <div>
              <label htmlFor="modifier-name" className="mb-1 block text-sm font-medium">
                Name
              </label>
              <Input
                id="modifier-name"
                name="name"
                type="text"
                defaultValue={modifierUnique.name}
                className="border-border w-full rounded-lg border px-3 py-2"
                required
              />
            </div>

            <div>
              <label htmlFor="modifier-price" className="mb-1 block text-sm font-medium">
                Price
              </label>
              <Input
                id="modifier-price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={Number(modifierUnique.price)}
                className="border-border w-full rounded-lg border px-3 py-2"
                required
              />
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Products</legend>
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
                        defaultChecked={modifierUnique.products.some(
                          (assignedProduct) => assignedProduct.id === product.id,
                        )}
                      />
                      <span>{product.name}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                Select at least one product. Removing a product only removes its link to this
                modifier.
              </p>
            </fieldset>

            <div>
              <label htmlFor="modifier-group" className="mb-1 block text-sm font-medium">
                Modifier Group
              </label>
              <NativeSelect
                id="modifier-group"
                name="modifierGroupId"
                defaultValue={modifierUnique.modifierGroupId}
                className="border-border w-full rounded-lg border px-3 py-2"
                required
              >
                {modifierGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <label htmlFor="modifier-active" className="text-md flex items-center gap-2">
              <Input
                id="modifier-active"
                name="isActive"
                type="checkbox"
                className="h-4 w-4 shrink-0"
                defaultChecked={modifierUnique.isActive}
              />
              Active
            </label>

            <PronunciationRecorder
              inputName="pronunciationAudioUrl"
              entityType="modifier"
              label={modifierUnique.name}
              currentUrl={modifierUnique.pronunciationAudioUrl}
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </section>

        <DeleteCatalogItemSection
          id={modifierUnique.id}
          name={modifierUnique.name}
          label="Delete Modifier"
          action={deleteModifier}
        />
      </div>
    </div>
  );
}
