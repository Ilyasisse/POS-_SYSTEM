import { AdminPage, Button, Card, ToneBadge } from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ToastOnMount } from "@/components/ui/toast";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  formatAvailabilityMinute,
  isProductAvailableAt,
} from "@/lib/menu/product-availability";
import { prisma } from "@/lib/prisma";
import { updateProductAvailabilityAction } from "./actions";

type MenuAvailabilityPageProps = {
  searchParams?: Promise<{ availabilityStatus?: string }>;
};

async function loadProducts() {
  const now = new Date();
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      availabilityStartMinute: true,
      availabilityEndMinute: true,
      category: { select: { name: true } },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  return products.map((product) => ({
    ...product,
    availableNow: isProductAvailableAt(product, now),
  }));
}

function notice(status?: string) {
  if (status === "updated") {
    return { tone: "success" as const, message: "Menu hours updated." };
  }
  if (status === "invalid") {
    return {
      tone: "error" as const,
      message: "Choose different valid start and end times.",
    };
  }
  if (status === "failed") {
    return { tone: "error" as const, message: "Menu hours could not be updated." };
  }
  return null;
}

export default async function MenuAvailabilityPage({
  searchParams,
}: MenuAvailabilityPageProps) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const [products, params] = await Promise.all([loadProducts(), searchParams]);
  const message = notice(params?.availabilityStatus);

  return (
    <AdminPage
      title="Menu hours"
      description="Show products only during their daily Africa/Nairobi service window. Overnight windows are supported."
    >
      {message ? (
        <ToastOnMount tone={message.tone} description={message.message} />
      ) : null}
      <div className="grid gap-4">
        {products.length ? (
          products.map((product) => {
            const scheduled = product.availabilityStartMinute !== null;
            return (
              <Card key={product.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-black">{product.name}</h2>
                      <ToneBadge tone={product.availableNow ? "green" : "amber"}>
                        {product.availableNow ? "AVAILABLE NOW" : "OUTSIDE HOURS"}
                      </ToneBadge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {product.category.name} · {scheduled ? "Daily schedule" : "Always available"}
                    </p>
                  </div>
                  <form
                    action={updateProductAvailabilityAction}
                    className="grid w-full gap-3 sm:w-auto sm:grid-cols-[10rem_8rem_8rem_auto] sm:items-end"
                  >
                    <input type="hidden" name="productId" value={product.id} />
                    <label className="grid gap-1 text-xs font-bold">
                      Availability
                      <NativeSelect name="mode" defaultValue={scheduled ? "SCHEDULED" : "ALWAYS"}>
                        <option value="ALWAYS">Always</option>
                        <option value="SCHEDULED">Scheduled</option>
                      </NativeSelect>
                    </label>
                    <label className="grid gap-1 text-xs font-bold">
                      Start
                      <Input
                        name="start"
                        type="time"
                        defaultValue={formatAvailabilityMinute(product.availabilityStartMinute)}
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-bold">
                      End
                      <Input
                        name="end"
                        type="time"
                        defaultValue={formatAvailabilityMinute(product.availabilityEndMinute)}
                      />
                    </label>
                    <Button type="submit">Save</Button>
                  </form>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="p-8 text-center text-sm text-slate-500">
            No active products to schedule.
          </Card>
        )}
      </div>
    </AdminPage>
  );
}
