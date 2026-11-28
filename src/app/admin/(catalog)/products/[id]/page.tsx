import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recordedPrice } from "@/lib/products/price-history";
import { deleteProduct, updateProduct } from "../actions";
import { DeleteCatalogItemSection } from "../../DeleteCatalogItemSection";
import PronunciationRecorder from "@/components/admin/pronunciations/PronunciationRecorder";
import PriceChangeFields from "./PriceChangeFields";
import { ProductMenuFields } from "../ProductMenuFields";

type ProductDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductDetailsPage({ params }: ProductDetailsPageProps) {
  const { id } = await params;

  const [product, categories, priceChanges] = await Promise.all([
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
    prisma.auditLog.findMany({
      where: {
        entityType: "Product",
        entityId: id,
        action: "product.price.changed",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        createdAt: true,
        previousValue: true,
        newValue: true,
        reason: true,
        actor: { select: { fullName: true } },
      },
    }),
  ]);

  if (!product) {
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
            <h1 className="text-2xl font-bold">Product Details</h1>
            <p className="text-muted-foreground text-sm">{product.name}</p>
          </div>

          <Link
            prefetch={false}
            href="/admin/products"
            className="border-border hover:bg-card rounded-lg border px-4 py-2 text-sm"
          >
            Back
          </Link>
        </header>

        <section className="border-border bg-card rounded-2xl border p-6 shadow-lg">
          <h2 className="text-foreground mb-4 text-lg font-bold">Edit Product</h2>

          <form action={updateProduct} className="space-y-4">
            <Input type="hidden" name="id" value={product.id} />

            <div>
              <label htmlFor="product-name" className="mb-1 block text-sm font-medium">
                Name
              </label>
              <Input
                id="product-name"
                name="name"
                type="text"
                defaultValue={product.name}
                className="border-border w-full rounded-lg border px-3 py-2"
                required
              />
            </div>

            <PriceChangeFields initialPrice={Number(product.price)} />
            <ProductMenuFields description={product.description} imageUrl={product.imageUrl} />

            <div>
              <label htmlFor="product-category" className="mb-1 block text-sm font-medium">
                Category
              </label>
              <NativeSelect
                id="product-category"
                name="categoryId"
                defaultValue={product.categoryId}
                className="border-border w-full rounded-lg border px-3 py-2"
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <label htmlFor="product-track-stock" className="text-md flex items-center gap-2">
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
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          <h2 className="text-lg font-bold text-slate-800">Recent price changes</h2>
          {priceChanges.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No audited price changes yet.</p>
          ) : (
            <ol className="mt-4 divide-y divide-slate-100">
              {priceChanges.map((change) => (
                <li key={change.id} className="py-3 text-sm">
                  <p className="font-semibold text-slate-900">
                    {recordedPrice(change.previousValue)} → {recordedPrice(change.newValue)}
                  </p>
                  <p className="text-slate-600">{change.reason}</p>
                  <p className="text-xs text-slate-500">
                    {change.actor?.fullName ?? "Former staff member"} ·{" "}
                    {change.createdAt.toLocaleString("en-US", {
                      timeZone: "Africa/Nairobi",
                    })}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <DeleteCatalogItemSection
          id={product.id}
          name={product.name}
          label="Delete Product"
          action={deleteProduct}
        />
      </div>
    </div>
  );
}
