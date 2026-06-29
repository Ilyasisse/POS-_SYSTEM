import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import {
  formatCashierBusinessDayRange,
  getCashierBusinessDayRange,
} from "@/lib/cashier/cashier-business-day";
import {
  CASHIER_DELETED_ORDER_ITEM_COOKIE,
  parseDeletedOrderItemSnapshots,
  type DeletedOrderItemSnapshot,
} from "@/lib/cashier/cashier-order-item-undo";
import {
  deleteWaiterOrderItem,
  discardDeletedWaiterOrderItem,
  restoreDeletedWaiterOrderItem,
} from "./actions";

type CashierWaiterOrdersPageProps = {
  searchParams?: Promise<{
    waiterId?: string;
  }>;
};

type WaiterOption = {
  id: string;
  fullName: string;
  email: string | null;
};

type WaiterOrderRow = {
  id: string;
  orderNumber: number;
  total: unknown;
  createdAt: Date;
  table: { name: string } | null;
  orderItems: Array<{
    id: string;
    productName: string;
    qty: number;
    lineTotal: unknown;
  }>;
};

type WaiterOrdersHeaderProps = {
  fullName: string;
  businessDayLabel: string;
};

type WaiterFilterProps = {
  waiters: WaiterOption[];
  selectedWaiterId: string;
};

type WaiterOrderMetricsProps = {
  selectedWaiter: WaiterOption | null;
  totalOrders: number;
  totalSales: number;
};

type WaiterOrdersTableProps = {
  orders: WaiterOrderRow[];
  selectedWaiter: WaiterOption | null;
  selectedWaiterId: string;
};

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDateTime(date: Date) {
  return dateTimeFormatter.format(date);
}

function WaiterOrdersHeader({
  fullName,
  businessDayLabel,
}: WaiterOrdersHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Manager waiter order review</h1>
        <p className="mt-2 text-sm text-slate-600">Welcome {fullName}</p>
        <p className="text-sm text-slate-500">
          Maalinta cashier-ka: {businessDayLabel}
        </p>
      </div>

      <Link
        href="/manager"
        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Back to manager
      </Link>
    </div>
  );
}

function WaiterFilter({ waiters, selectedWaiterId }: WaiterFilterProps) {
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <form className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="w-full">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Kabalyeeri
          </span>
          <AutoSubmitSelect
            name="waiterId"
            defaultValue={selectedWaiterId}
            className="w-full rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-blue-500"
          >
            {waiters.length === 0 ? (
              <option value="">Waiters lama helin</option>
            ) : (
              waiters.map((waiter) => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.fullName}
                </option>
              ))
            )}
          </AutoSubmitSelect>
        </label>
      </form>
    </div>
  );
}

function DeletedOrderItemsPanel({
  deletedItems,
}: {
  deletedItems: DeletedOrderItemSnapshot[];
}) {
  if (deletedItems.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-sm font-semibold text-amber-900">
          Dalabyo tirtiran
        </p>
        <p className="text-sm text-amber-800">
          Waad soo celin kartaa ama ka saar liiska.
        </p>
      </div>

      <div className="space-y-3">
        {deletedItems.map((deletedItem) => (
          <div
            key={deletedItem.undoId}
            className="rounded-xl border border-amber-200 bg-white px-4 py-3"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-slate-900">
                  {deletedItem.item.qty}x {deletedItem.item.productName}
                </p>
                <p className="text-sm text-slate-600">
                  Order #{deletedItem.order.orderNumber}
                  {deletedItem.waiterName ? `, ${deletedItem.waiterName}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <form action={restoreDeletedWaiterOrderItem}>
                  <input
                    type="hidden"
                    name="undoId"
                    value={deletedItem.undoId}
                  />
                  <input
                    type="hidden"
                    name="waiterId"
                    value={deletedItem.waiterId}
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    Soo celi
                  </button>
                </form>

                <form action={discardDeletedWaiterOrderItem}>
                  <input
                    type="hidden"
                    name="undoId"
                    value={deletedItem.undoId}
                  />
                  <input
                    type="hidden"
                    name="waiterId"
                    value={deletedItem.waiterId}
                  />
                  <button
                    type="submit"
                    className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WaiterOrderMetrics({
  selectedWaiter,
  totalOrders,
  totalSales,
}: WaiterOrderMetricsProps) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Waiter la doortay</p>
        <h2 className="mt-2 text-xl font-bold">
          {selectedWaiter?.fullName ?? "None"}
        </h2>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Dalabyo la helay</p>
        <h2 className="mt-2 text-2xl font-bold">{totalOrders}</h2>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Qiimaha dalabyada</p>
        <h2 className="mt-2 text-2xl font-bold">{formatMoney(totalSales)}</h2>
      </div>
    </div>
  );
}

function WaiterOrdersTable({
  orders,
  selectedWaiter,
  selectedWaiterId,
}: WaiterOrdersTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold">Dalabyada waiter-ka la doortay</h2>
      </div>

      {selectedWaiter === null ? (
        <div className="p-6 text-sm text-slate-500">
          Ma jiraan waiters la muujiyo
        </div>
      ) : orders.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          Dalabyo looma helin {selectedWaiter.fullName}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Order
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  La sameeyay
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Alaabaha dalabka
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Total
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Delete orderka
                </th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <WaiterOrderRow
                  key={order.id}
                  order={order}
                  selectedWaiterId={selectedWaiterId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WaiterOrderRow({
  order,
  selectedWaiterId,
}: {
  order: WaiterOrderRow;
  selectedWaiterId: string;
}) {
  const orderItemsText = order.orderItems
    .map((item) => `${item.qty}x ${item.productName}`)
    .join(", ");

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-medium">#{order.orderNumber}</td>
      <td className="px-4 py-3 text-slate-600">
        {formatDateTime(order.createdAt)}
      </td>
      <td className="px-4 py-3 text-slate-600">
        <p>{orderItemsText || "No items"}</p>
        <div className="mt-2 space-y-1">
          {order.orderItems.map((item) => (
            <p key={item.id} className="text-xs text-slate-500">
              {item.qty}x {item.productName} (
              {formatMoney(Number(item.lineTotal))})
            </p>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 font-medium">
        {formatMoney(Number(order.total))}
      </td>
      <td className="px-4 py-3">
        <div className="space-y-2">
          {order.orderItems.map((item) => (
            <div key={item.id} className="space-y-2">
              {Array.from({ length: item.qty }).map((_, unitIndex) => (
                <form key={`${item.id}-${unitIndex}`} action={deleteWaiterOrderItem}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="orderItemId" value={item.id} />
                  <input type="hidden" name="waiterId" value={selectedWaiterId} />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Delete 1 {item.productName}
                  </button>
                </form>
              ))}
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}

export default async function CashierWaiterOrdersPage({
  searchParams,
}: CashierWaiterOrdersPageProps) {
  const { start: businessDayStart, end: businessDayEnd } =
    getCashierBusinessDayRange();
  const businessDayLabel = formatCashierBusinessDayRange(
    businessDayStart,
    businessDayEnd,
  );

  const [currentUser, params, cookieStore, waiters] = await Promise.all([
    requirePermission(PERMISSIONS.ORDER_MANAGE),
    searchParams,
    cookies(),
    prisma.user.findMany({
      where: {
        role: "WAITER",
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
      orderBy: {
        fullName: "asc",
      },
    }),
  ]);
  const deletedItems = parseDeletedOrderItemSnapshots(
    cookieStore.get(CASHIER_DELETED_ORDER_ITEM_COOKIE)?.value,
  ).filter((snapshot) => {
    const orderCreatedAt = new Date(snapshot.order.createdAt);

    return (
      orderCreatedAt >= businessDayStart && orderCreatedAt < businessDayEnd
    );
  });

  const selectedWaiterId = waiters.some(
    (waiter) => waiter.id === params?.waiterId,
  )
    ? (params?.waiterId ?? "")
    : (waiters[0]?.id ?? "");

  const selectedWaiter =
    waiters.find((waiter) => waiter.id === selectedWaiterId) ?? null;

  const orders = selectedWaiterId
    ? await prisma.order.findMany({
        where: {
          waiterId: selectedWaiterId,
          createdAt: {
            gte: businessDayStart,
            lt: businessDayEnd,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          table: {
            select: {
              name: true,
            },
          },
          orderItems: {
            select: {
              id: true,
              productName: true,
              qty: true,
              lineTotal: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      })
    : [];

  const totalOrders = orders.length;
  const totalSales = orders.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );

  return (
    <main className="p-6">
      <WaiterOrdersHeader
        fullName={currentUser.fullName}
        businessDayLabel={businessDayLabel}
      />

      <WaiterFilter waiters={waiters} selectedWaiterId={selectedWaiterId} />

      <DeletedOrderItemsPanel deletedItems={deletedItems} />

      <WaiterOrderMetrics
        selectedWaiter={selectedWaiter}
        totalOrders={totalOrders}
        totalSales={totalSales}
      />

      <WaiterOrdersTable
        orders={orders}
        selectedWaiter={selectedWaiter}
        selectedWaiterId={selectedWaiterId}
      />
    </main>
  );
}
