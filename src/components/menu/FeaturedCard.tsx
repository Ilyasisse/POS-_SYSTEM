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

export default function FeaturedCard({ item }: { item: MenuProduct }) {
  return (
    <Card className="dark:border-border dark:bg-card gap-0 overflow-hidden rounded-3xl border border-white/50 bg-white/75 py-0 shadow-[0_18px_46px_rgba(67,39,20,0.08)] backdrop-blur">
      {/* Featured image section */}
      <div className="dark:bg-muted relative aspect-5/4 overflow-hidden bg-[linear-gradient(135deg,#5a3320_0%,#8f5b32_55%,#d4a169_100%)] dark:bg-none">
        <ProductImage
          src={item.imageUrl}
          alt={item.name}
          sizes="(min-width: 1280px) 220px, (min-width: 640px) 50vw, 100vw"
        />
      </div>

      {/* Featured item information */}
      <div className="p-4 text-center">
        {/* Featured item name */}
        <p
          className="text-foreground text-2xl"
          style={{
            fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
          }}
        >
          {item.name}
        </p>

        {/* Featured item description */}
        <p className="text-muted-foreground mt-1 text-[14px] leading-5">{item.description}</p>

        {/* Featured item price */}
        <p className="dark:text-primary mt-3 text-2xl font-semibold text-[#b87735]">
          {formatPrice(item.price)}
        </p>
      </div>
    </Card>
  );
}
