import { MenuProduct } from "@/app/menu/menu-data";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatPrice(value: number) {
  return currencyFormatter.format(value);
}

export default function FeaturedCard({ item, index }: { item: MenuProduct; index: number }) {
  return (
    <article
      data-aos="fade-up"
      // Delays animation slightly for staggered effect
      data-aos-delay={String(index * 60)}
      className="overflow-hidden rounded-3xl border border-white/50 bg-white/75 shadow-[0_18px_46px_rgba(67,39,20,0.08)] backdrop-blur"
    >
      {/* Featured image section */}
      <div className="aspect-5/4 overflow-hidden bg-[linear-gradient(135deg,#5a3320_0%,#8f5b32_55%,#d4a169_100%)]">
        {/* Only render image if imageUrl exists */}
        {item.imageUrl ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${item.imageUrl})` }}
          />
        ) : null}
      </div>

      {/* Featured item information */}
      <div className="p-4 text-center">
        {/* Featured item name */}
        <p
          className="text-2xl text-[#2f180d]"
          style={{
            fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
          }}
        >
          {item.name}
        </p>

        {/* Featured item description */}
        <p className="mt-1 text-[14px] leading-5 text-[#8a6a55]">
          {item.description}
        </p>

        {/* Featured item price */}
        <p className="mt-3 text-2xl font-semibold text-[#b87735]">
          {formatPrice(item.price)}
        </p>
      </div>
    </article>
  );
}
