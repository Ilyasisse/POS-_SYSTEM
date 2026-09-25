import { MenuProduct } from "@/lib/menu/menu-data";
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
    <Card
      data-aos="fade-right"
      className="group gap-0 overflow-hidden rounded-[28px] border border-[#e4d2bf] bg-white/90 py-0 shadow-[0_22px_60px_rgba(73,37,16,0.10)] dark:bg-card"
    >
      {/* Product image container */}
      <div className="relative aspect-4/3 overflow-hidden bg-[linear-gradient(135deg,#5a3320_0%,#8f5b32_55%,#d4a169_100%)]">
        {/* Only show image if product has imageUrl */}
        {product.imageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${product.imageUrl})` }}
          />
        ) : null}

        {/* Dark overlay added on top of image for readability */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(25,14,7,0.04)_10%,rgba(25,14,7,0.18)_48%,rgba(25,14,7,0.82)_100%)]">
          {/* Category badge shown on top-right */}
          <span className="absolute right-4 top-4 rounded-full border border-[#f4dcc2]/80 bg-[#6c3f20]/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#fff6ec]">
            {product.categoryName}
          </span>
        </div>
      </div>

      {/* Product content section */}
      <div className="flex flex-col justify-between gap-2 p-5 text-center lg:p-4 xl:p-5">
        {/* Product name */}
        <h3
          className="break-words text-4xl font-semibold leading-none sm:text-3xl lg:text-2xl xl:text-3xl"
          style={{
            fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
          }}
        >
          {product.name}
        </h3>

        {/* Product description */}
        <p className="break-words text-lg leading-6 text-[#6c5a4f] sm:text-base xl:text-lg">
          {product.description}
        </p>

        {/* Product price */}
        <div className="rounded-full px-4 py-2 text-3xl font-semibold text-[#B5651D] lg:text-2xl xl:text-3xl">
          {formatPrice(product.price)}
        </div>
      </div>
    </Card>
  );
}
