import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createProduct } from "../actions";
import PronunciationRecorder from "@/components/admin/pronunciations/PronunciationRecorder";
import { ProductMenuFields } from "../ProductMenuFields";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
  });

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
            <h1 className="text-2xl font-bold">Create Product</h1>
          </div>
        </header>

        <section className="border-border bg-card rounded-2xl border p-6 shadow-lg">
          <form action={createProduct} className="space-y-4">
            <div>
              <label htmlFor="new-product-name" className="mb-1 block text-sm font-medium">
                Name
              </label>
              <Input
                id="new-product-name"
                name="name"
                type="text"
                className="border-border w-full rounded-lg border px-3 py-2"
                placeholder="Product name"
                required
              />
            </div>

            <label
              htmlFor="new-product-open-price"
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
            >
              <Input
                id="new-product-open-price"
                name="isOpenPrice"
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>
                <strong className="block text-sm text-amber-950 dark:text-amber-100">
                  Cashier enters the price
                </strong>
                <span className="mt-1 block text-xs text-amber-800 dark:text-amber-200">
                  Use the listed price as a reference. Customer self-ordering will hide this
                  product.
                </span>
              </span>
            </label>
            <ProductMenuFields />

            <div>
              <label htmlFor="new-product-price" className="mb-1 block text-sm font-medium">
                Price
              </label>
              <Input
                id="new-product-price"
                name="price"
                type="number"
                step="0.01"
                className="border-border w-full rounded-lg border px-3 py-2"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label htmlFor="new-product-category" className="mb-1 block text-sm font-medium">
                Category
              </label>
              <NativeSelect
                id="new-product-category"
                name="categoryId"
                className="border-border w-full rounded-lg border px-3 py-2"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select category
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <label htmlFor="new-product-track-stock" className="text-md flex items-center gap-2">
              <Input
                id="new-product-track-stock"
                name="trackStock"
                type="checkbox"
                className="h-4 w-4 shrink-0"
              />
              Track Stock
            </label>

            <PronunciationRecorder
              inputName="pronunciationAudioUrl"
              entityType="product"
              label="Product pronunciation"
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2"
              >
                Create Product
              </Button>

              <Link
                prefetch={false}
                href="/admin/products"
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
