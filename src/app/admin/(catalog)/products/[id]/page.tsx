import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
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
            <h1 className="text-2xl font-bold">Product Details</h1>
            <p className="text-sm text-muted-foreground">{product.name}</p>
          </div>

          <Link
            prefetch={false}
            href="/admin/products"
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-card"
          >
            Back
          </Link>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-bold text-foreground">
            Edit Product
          </h2>

          <form action={updateProduct} className="space-y-4">
            <Input type="hidden" name="id" value={product.id} />

            <div>
              <label
                htmlFor="product-name"
                className="mb-1 block text-sm font-medium"
              >
                Name
              </label>
              <Input
                id="product-name"
                name="name"
                type="text"
                defaultValue={product.name}
                className="w-full rounded-lg border border-border px-3 py-2"
                required
              />
            </div>

            <label
              htmlFor="product-open-price"
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
            >
              <Input
                id="product-open-price"
                name="isOpenPrice"
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0"
                defaultChecked={product.isOpenPrice}
              />
              <span>
                <strong className="block text-sm text-amber-950 dark:text-amber-100">
                  Cashier enters the price
                </strong>
                <span className="mt-1 block text-xs text-amber-800 dark:text-amber-200">
                  Customer self-ordering hides this product. Fixed-price
                  products never accept a client-supplied override.
                </span>
              </span>
            </label>

            <div>
              <label
                htmlFor="product-price"
                className="mb-1 block text-sm font-medium"
              >
                Price
              </label>
              <Input
                id="product-price"
                name="price"
                type="number"
                step="0.01"
                defaultValue={Number(product.price)}
                className="w-full rounded-lg border border-border px-3 py-2"
                required
              />
            </div>

            <div>
              <label
                htmlFor="product-category"
                className="mb-1 block text-sm font-medium"
              >
                Category
              </label>
              <NativeSelect
                id="product-category"
                name="categoryId"
                defaultValue={product.categoryId}
                className="w-full rounded-lg border border-border px-3 py-2"
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <label
              htmlFor="product-track-stock"
              className="flex items-center gap-2 text-md"
            >
              <Input
                id="product-track-stock"
                name="trackStock"
                type="checkbox"
                className="h-4 w-4 shrink-0"
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
            Delete Product
          </h2>

          <p className="mb-4 text-sm text-muted-foreground">
            This will permanently delete{" "}
            <span className="font-semibold">{product.name}</span>.
          </p>

          <form action={deleteProduct}>
            <Input type="hidden" name="id" value={product.id} />
            <Button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Delete Product
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
