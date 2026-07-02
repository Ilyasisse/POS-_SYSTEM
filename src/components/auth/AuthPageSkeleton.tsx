import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthPageSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md items-center gap-5 rounded-[30px] p-6">
        <Skeleton className="size-20 rounded-2xl" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-xs" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </Card>
    </main>
  );
}
