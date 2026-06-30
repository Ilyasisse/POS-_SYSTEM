import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SupplierPortalLoading() {
  return (
    <main className="min-h-screen bg-muted/35 p-6">
      <Card className="mx-auto max-w-lg gap-5 rounded-[2rem] p-6">
        <Skeleton className="mx-auto size-20 rounded-2xl" />
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-12 w-full" />
      </Card>
    </main>
  );
}
