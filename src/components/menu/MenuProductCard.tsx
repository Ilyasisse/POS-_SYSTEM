import ProductImage from "@/components/products/ProductImage";
import type { MenuProduct } from "@/types/menu/menu-types";
import { Card } from "@/components/ui/card";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatPrice(value: number) {
  return currencyFormatter.format(value);
}

export default function ProductCard({ product }: { product: MenuProduct }) {
  return (
    <Card className="group dark:border-border dark:bg-card gap-0 overflow-hidden rounded-[28px] border border-[#e4d2bf] bg-white/90 py-0 shadow-[0_22px_60px_rgba(73,37,16,0.10)]">
      {/* Product image container */}
      <div className="dark:bg-muted relative aspect-4/3 overflow-hidden bg-[linear-gradient(135deg,#5a3320_0%,#8f5b32_55%,#d4a169_100%)] dark:bg-none">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          sizes="(min-width: 1280px) 400px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        />

        {/* Dark overlay added on top of image for readability */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(25,14,7,0.04)_10%,rgba(25,14,7,0.18)_48%,rgba(25,14,7,0.82)_100%)]">
          {/* Category badge shown on top-right */}
          <span className="absolute top-4 right-4 rounded-full border border-[#f4dcc2]/80 bg-[#6c3f20]/85 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-[#fff6ec] uppercase">
            {product.categoryName}
          </span>
        </div>
      </div>

      {/* Product content section */}
      <div className="flex flex-col justify-between gap-2 p-5 text-center lg:p-4 xl:p-5">
        {/* Product name */}
        <h3
          className="text-4xl leading-none font-semibold break-words sm:text-3xl lg:text-2xl xl:text-3xl"
          style={{
            fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
          }}
        >
          {product.name}
        </h3>

        {/* Product description */}
        <p className="text-muted-foreground text-lg leading-6 break-words sm:text-base xl:text-lg">
          {product.description}
        </p>

        {/* Product price */}
        <div className="dark:text-primary rounded-full px-4 py-2 text-3xl font-semibold text-[#B5651D] lg:text-2xl xl:text-3xl">
          {formatPrice(product.price)}
        </div>
      </div>
    </Card>
  );
}
