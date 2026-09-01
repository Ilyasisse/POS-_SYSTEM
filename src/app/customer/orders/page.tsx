import Link from "next/link";
import { Clock3, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { getCustomerOrderProgress } from "@/lib/customer/order-progress";
import { prisma } from "@/lib/prisma";
import AutoRefresh from "./AutoRefresh";

const money = (value: unknown) => `$${Number(value ?? 0).toFixed(2)}`;
const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});
const toneClass = {
  error: "bg-red-100 text-red-700",
  complete: "bg-emerald-100 text-emerald-700",
  ready: "bg-blue-100 text-blue-700",
  active: "bg-amber-100 text-amber-800",
  queued: "bg-stone-100 text-stone-700",
};

export default async function CustomerOrderHistoryPage() {
  const customer = await requirePermission(PERMISSIONS.CUSTOMER_ORDER);
  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      orderItems: {
        orderBy: { createdAt: "asc" },
        include: { modifiers: { orderBy: { modifierName: "asc" } } },
      },
      kitchenTicketState: {
        include: { stationStates: { orderBy: { station: "asc" } } },
      },
    },
  });

  return (
    <main className="min-h-dvh bg-[#f6efe5] p-4 text-stone-950 sm:p-6">
      <AutoRefresh />
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-800">
              Mash Allah Cafe
            </p>
            <h1 className="mt-1 text-3xl font-bold">My orders</h1>
            <p className="mt-1 text-sm text-stone-600">
              Live preparation progress and your 25 most recent orders.
            </p>
          </div>
          <Button asChild>
            <Link href="/customer">Order more</Link>
          </Button>
        </header>

        {orders.length ? (
          <section className="space-y-4">
            {orders.map((order) => {
              const progress = getCustomerOrderProgress({
                orderStatus: order.status,
                pickupStatus: order.kitchenTicketState?.pickupStatus,
                stationStatuses:
                  order.kitchenTicketState?.stationStates.map(
                    (station) => station.status,
                  ) ?? [],
              });

              return (
                <Card key={order.id} className="overflow-hidden p-0">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
                    <div>
                      <h2 className="text-xl font-bold">
                        Order #{order.orderNumber}
                      </h2>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock3 className="size-4" />
                        {dateTime.format(order.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${toneClass[progress.tone]}`}
                      >
                        {progress.label}
                      </span>
                      <p className="mt-2 text-xl font-bold">
                        {money(order.total)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm">
                      {progress.description}
                    </p>
                    <div className="space-y-3">
                      {order.orderItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3"
                        >
                          <div>
                            <p className="font-semibold">
                              {item.qty}× {item.productName}
                            </p>
                            {item.modifiers.length ? (
                              <p className="text-xs text-muted-foreground">
                                {item.modifiers
                                  .map(
                                    (modifier) =>
                                      `${modifier.qty}× ${modifier.modifierName}`,
                                  )
                                  .join(", ")}
                              </p>
                            ) : null}
                          </div>
                          <span className="font-medium">
                            {money(item.lineTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>
        ) : (
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="Place your first order from the cafe menu, then track it here."
            action={
              <Button asChild>
                <Link href="/customer">Browse menu</Link>
              </Button>
            }
          />
        )}
      </div>
    </main>
  );
}
