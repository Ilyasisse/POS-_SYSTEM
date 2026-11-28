import { Skeleton } from "@/components/ui/skeleton";
export default function MenuProductsLoading() {
  return (
    <div
      id="menu-grid"
      aria-label="Loading menu products"
      role="status"
      className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8"
    >
      <Skeleton className="relative -mt-10 h-32 rounded-[32px]" />
      <div className="py-16 text-center">
        <Skeleton className="mx-auto h-12 w-64" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="aspect-4/3 rounded-[28px]" />
        ))}
      </div>
      <span className="sr-only">Loading menu products</span>
    </div>
  );
}
