import { MenuProduct } from "@/lib/menu/menu-data";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatPrice(value: number) {
  return currencyFormatter.format(value);
}

export default function ProductCard({ product }: { product: MenuProduct }) {
  return (
    <article
      data-aos="fade-right"
      className="group overflow-hidden rounded-[28px] border border-[#e4d2bf] bg-white/90 shadow-[0_22px_60px_rgba(73,37,16,0.10)]"
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
      <div className="space-y-0.5 p-5 flex flex-col justify-between gap-2 text-center ">
        {/* Product name */}
        <h3
          className="text-4xl sm:text-3xl  leading-none font-semibold  "
          style={{
            fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
          }}
        >
          {product.name}
        </h3>

        {/* Product description */}
        <p className=" text-lg  leading-6 text-[#6c5a4f] sm:text-md">
          {product.description}
        </p>

        {/* Product price */}
        <div className="rounded-full px-4 py-2 text-3xl font-semibold text-[#B5651D] ">
          {formatPrice(product.price)}
        </div>
      </div>
    </article>
  );
}
