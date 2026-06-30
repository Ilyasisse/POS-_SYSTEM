import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function AdminNotFound({
  title = "Admin resource not found",
  description = "The requested resource does not exist or is no longer available.",
  href = "/admin/dashboard",
  linkLabel = "Back to dashboard",
}: {
  title?: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center p-6">
      <EmptyState
        className="w-full bg-card"
        icon={SearchX}
        title={title}
        description={description}
        action={
          <Button asChild>
            <Link href={href}>{linkLabel}</Link>
          </Button>
        }
      />
    </div>
  );
}
