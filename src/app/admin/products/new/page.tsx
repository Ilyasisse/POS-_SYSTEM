import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createProduct } from "../actions";
import PronunciationRecorder from "@/components/admin/pronunciations/PronunciationRecorder";
import { Textarea } from "@/components/ui/textarea";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
  });

  return (
    <div
      className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Admin Dashboard
            </p>
            <h1 className="text-2xl font-bold">Create Product</h1>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Product name"
                required
              />
            </div>

            <div>
              <label
                htmlFor="new-product-description"
                className="mb-1 block text-sm font-medium"
              >
                Menu description
              </label>
              <Textarea
                id="new-product-description"
                name="description"
                maxLength={1000}
                placeholder="Describe ingredients, preparation, or serving details"
              />
            </div>

            <div>
              <label
                htmlFor="new-product-image-url"
                className="mb-1 block text-sm font-medium"
              >
                Image URL
              </label>
              <Input
                id="new-product-image-url"
                name="imageUrl"
                type="text"
                maxLength={2048}
                placeholder="https://example.com/burger.jpg or /images/burger.jpg"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
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

            <div className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
              <label
                htmlFor="new-product-is-active"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <Input
                  id="new-product-is-active"
                  name="isActive"
                  type="checkbox"
                  className="h-4 w-4 shrink-0"
                  defaultChecked
                />
                Visible on menus
              </label>
              <label
                htmlFor="new-product-is-popular"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <Input
                  id="new-product-is-popular"
                  name="isPopular"
                  type="checkbox"
                  className="h-4 w-4 shrink-0"
                />
                Feature as popular
              </label>
            </div>

            <PronunciationRecorder
              inputName="pronunciationAudioUrl"
              entityType="product"
              label="Product pronunciation"
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Create Product
              </Button>

              <Link
                href="/admin/products"
                className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50"
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
