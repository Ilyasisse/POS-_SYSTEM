import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteModifier, updateModifier } from "../actions";
import PronunciationRecorder from "@/app/components/admin/PronunciationRecorder";

type ModifierDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ModifierDetailsPage({
  params,
}: ModifierDetailsPageProps) {
  const { id } = await params;

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
            <h1 className="text-2xl font-bold">Modifier Details</h1>
            <p className="text-sm text-slate-500">{modifier.name}</p>
          </div>

          <Link
            href="/admin/modifiers"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Back
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-bold text-slate-800">
            Edit Modifier
          </h2>

          <form action={updateModifier} className="space-y-4">
            <input type="hidden" name="id" value={modifier.id} />

            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                name="name"
                type="text"
                defaultValue={modifier.name}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Price</label>
              <input
                name="price"
                type="number"
                step="0.01"
                defaultValue={Number(modifier.price)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Product</label>
              <select
                name="productId"
                defaultValue={modifier.productId}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Modifier Group
              </label>
              <select
                name="modifierGroupId"
                defaultValue={modifier.modifierGroupId}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              >
                {modifierGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                name="isActive"
                type="checkbox"
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
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-bold text-red-600">
            Delete Modifier
          </h2>

          <p className="mb-4 text-sm text-slate-600">
            This will permanently delete{" "}
            <span className="font-semibold">{modifier.name}</span>.
          </p>

          <form action={deleteModifier}>
            <input type="hidden" name="id" value={modifier.id} />
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Delete Modifier
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
