import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createProduct } from "../actions";
import PronunciationRecorder from "@/components/admin/pronunciations/PronunciationRecorder";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
  });

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
            <h1 className="text-2xl font-bold">Create Product</h1>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          <form action={createProduct} className="space-y-4">
            <div>
              <label
                htmlFor="new-product-name"
                className="mb-1 block text-sm font-medium"
              >
                Name
              </label>
              <Input
                id="new-product-name"
                name="name"
                type="text"
                className="w-full rounded-lg border border-border px-3 py-2"
                placeholder="Product name"
                required
              />
            </div>

            <div>
              <label
                htmlFor="new-product-price"
                className="mb-1 block text-sm font-medium"
              >
                Price
              </label>
              <Input
                id="new-product-price"
                name="price"
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-border px-3 py-2"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label
                htmlFor="new-product-category"
                className="mb-1 block text-sm font-medium"
              >
                Category
              </label>
              <NativeSelect
                id="new-product-category"
                name="categoryId"
                className="w-full rounded-lg border border-border px-3 py-2"
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

            <label
              htmlFor="new-product-track-stock"
              className="flex items-center gap-2 text-md"
            >
              <Input
                id="new-product-track-stock"
                name="trackStock"
                type="checkbox"
                className="h-4 w-4 shrink-0"
              />
              Track Stock
            </label>

            <div>
              <label
                htmlFor="new-product-allergens"
                className="mb-1 block text-sm font-medium"
              >
                Allergen information (optional)
              </label>
              <textarea
                id="new-product-allergens"
                name="allergenInfo"
                maxLength={240}
                rows={3}
                placeholder="For example: Contains milk; prepared near nuts"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <p className="mt-1 text-xs text-slate-600">
                Verify ingredients and preparation practices with the kitchen.
                Blank does not mean allergen-free.
              </p>
            </div>

            <PronunciationRecorder
              inputName="pronunciationAudioUrl"
              entityType="product"
              label="Product pronunciation"
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
              >
                Create Product
              </Button>

              <Link
                prefetch={false}
                href="/admin/products"
                className="rounded-lg border border-border px-4 py-2 hover:bg-card"
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
