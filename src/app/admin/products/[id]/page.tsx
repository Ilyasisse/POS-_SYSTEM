import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteProduct, updateProduct } from "../actions";
import PronunciationRecorder from "@/components/admin/pronunciations/PronunciationRecorder";

type ProductDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductDetailsPage({
  params,
}: ProductDetailsPageProps) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    }),
    prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  if (!product) {
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
            <h1 className="text-2xl font-bold">Product Details</h1>
            <p className="text-sm text-slate-500">{product.name}</p>
          </div>

          <Link
            href="/admin/products"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Back
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-bold text-slate-800">
            Edit Product
          </h2>

          <form action={updateProduct} className="space-y-4">
            <input type="hidden" name="id" value={product.id} />

            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                name="name"
                type="text"
                defaultValue={product.name}
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
                defaultValue={Number(product.price)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Category</label>
              <select
                name="categoryId"
                defaultValue={product.categoryId}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                name="trackStock"
                type="checkbox"
                defaultChecked={product.trackStock}
              />
              Track Stock
            </label>

            <PronunciationRecorder
              inputName="pronunciationAudioUrl"
              entityType="product"
              label={product.name}
              currentUrl={product.pronunciationAudioUrl}
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
            Delete Product
          </h2>

          <p className="mb-4 text-sm text-slate-600">
            This will permanently delete{" "}
            <span className="font-semibold">{product.name}</span>.
          </p>

          <form action={deleteProduct}>
            <input type="hidden" name="id" value={product.id} />
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Delete Product
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
