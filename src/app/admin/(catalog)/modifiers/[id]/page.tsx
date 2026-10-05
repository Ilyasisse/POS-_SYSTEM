import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole as requireAuth } from "@/lib/auth/require-role";
import { deleteModifier, updateModifier } from "../actions";
import PronunciationRecorder from "@/components/admin/pronunciations/PronunciationRecorder";

type ModifierDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ModifierDetailsPage({
  params,
}: ModifierDetailsPageProps) {
  // Params can resolve with auth; modifier reads still need the resolved id.
  const [resolvedParams] = await Promise.all([
    params,
    requireAuth(["ADMIN", "MANAGER"]),
  ]);
  const id = resolvedParams.id;

  const [modifier, products, modifierGroups] = await Promise.all([
    prisma.modifier.findUnique({
      where: { id },
      include: {
        product: true,
        modifierGroup: true,
      },
    }),
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

  if (!modifier) {
    notFound();
  }

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
            <h1 className="text-2xl font-bold">Modifier Details</h1>
            <p className="text-sm text-muted-foreground">{modifier.name}</p>
          </div>

          <Link
            prefetch={false}
            href="/admin/modifiers"
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-card"
          >
            Back
          </Link>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-bold text-foreground">
            Edit Modifier
          </h2>

          <form action={updateModifier} className="space-y-4">
            <Input type="hidden" name="id" value={modifier.id} />

            <div>
              <label
                htmlFor="modifier-name"
                className="mb-1 block text-sm font-medium"
              >
                Name
              </label>
              <Input
                id="modifier-name"
                name="name"
                type="text"
                defaultValue={modifier.name}
                className="w-full rounded-lg border border-border px-3 py-2"
                required
              />
            </div>

            <div>
              <label
                htmlFor="modifier-price"
                className="mb-1 block text-sm font-medium"
              >
                Price
              </label>
              <Input
                id="modifier-price"
                name="price"
                type="number"
                step="0.01"
                defaultValue={Number(modifier.price)}
                className="w-full rounded-lg border border-border px-3 py-2"
                required
              />
            </div>

            <div>
              <label
                htmlFor="modifier-product"
                className="mb-1 block text-sm font-medium"
              >
                Product
              </label>
              <NativeSelect
                id="modifier-product"
                name="productId"
                defaultValue={modifier.productId}
                className="w-full rounded-lg border border-border px-3 py-2"
                required
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div>
              <label
                htmlFor="modifier-group"
                className="mb-1 block text-sm font-medium"
              >
                Modifier Group
              </label>
              <NativeSelect
                id="modifier-group"
                name="modifierGroupId"
                defaultValue={modifier.modifierGroupId}
                className="w-full rounded-lg border border-border px-3 py-2"
                required
              >
                {modifierGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <label
              htmlFor="modifier-active"
              className="flex items-center gap-2 text-md"
            >
              <Input
                id="modifier-active"
                name="isActive"
                type="checkbox"
                className="h-4 w-4 shrink-0"
                defaultChecked={modifier.isActive}
              />
              Active
            </label>

            <PronunciationRecorder
              inputName="pronunciationAudioUrl"
              entityType="modifier"
              label={modifier.name}
              currentUrl={modifier.pronunciationAudioUrl}
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-red-200 dark:border-red-800 bg-card p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-bold text-red-600 dark:text-red-300">
            Delete Modifier
          </h2>

          <p className="mb-4 text-sm text-muted-foreground">
            This will permanently delete{" "}
            <span className="font-semibold">{modifier.name}</span>.
          </p>

          <form action={deleteModifier}>
            <Input type="hidden" name="id" value={modifier.id} />
            <Button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Delete Modifier
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
