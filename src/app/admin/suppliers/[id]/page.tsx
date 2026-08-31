import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import {
  AdminPage,
  Button,
  Card,
  DataTableCard,
  MetricCard,
  StatusBadge,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { ToastOnMount } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { getSupplierCatalogPriceTrend } from "@/lib/suppliers/purchase-orders";
import CatalogItemCreateForm from "./CatalogItemCreateForm";
import SupplierAccountSection from "./SupplierAccountSection";
import { updateSupplierCatalogItem } from "./actions";

type SupplierCatalogPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ catalogStatus?: string }>;
};

function statusNotice(status: string | undefined) {
  switch (status) {
    case "created":
      return { tone: "success", message: "Catalog item added." };
    case "updated":
      return { tone: "success", message: "Catalog price and status updated." };
    case "duplicate":
      return {
        tone: "error",
        message: "That item is already in this supplier's catalog.",
      };
    case "invalid_target":
    case "target_unavailable":
      return {
        tone: "error",
        message: "Choose an active product or inventory supply.",
      };
    case "invalid_unit":
      return {
        tone: "error",
        message: "Enter a purchasing unit between 1 and 40 characters.",
      };
    case "invalid_price":
      return {
        tone: "error",
        message: "Enter a non-negative price with no more than two decimals.",
      };
    case "not_found":
      return {
        tone: "error",
        message: "That supplier catalog item could not be found.",
      };
    default:
      return null;
  }
}

type SupplierCatalogRow = {
  id: string;
  unit: string;
  unitPrice: Prisma.Decimal;
  isActive: boolean;
  product: { name: string } | null;
  inventorySupply: { name: string } | null;
  purchaseOrderItems: Array<{
    unitPrice: Prisma.Decimal;
    purchaseOrder: { orderNumber: number };
  }>;
};

function SupplierCatalogTable({
  rows,
  supplierId,
}: {
  rows: SupplierCatalogRow[];
  supplierId: string;
}) {
  return (
    <DataTableCard>
      <Table>
        <thead>
          <tr>
            <TableHead>Item</TableHead>
            <TableHead>Current price</TableHead>
            <TableHead>Last ordered</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Update</TableHead>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((item) => {
              const itemName =
                item.product?.name ??
                item.inventorySupply?.name ??
                "Unavailable item";
              const itemType = item.product ? "Product" : "Inventory supply";
              const lastOrder = item.purchaseOrderItems[0];
              const trend = getSupplierCatalogPriceTrend(
                item.unitPrice,
                lastOrder?.unitPrice,
              );
              const trendTone =
                trend === "increased"
                  ? "red"
                  : trend === "decreased"
                    ? "green"
                    : trend === "unchanged"
                      ? "blue"
                      : "slate";

              return (
                <tr key={item.id} className="border-t align-top">
                  <TableCell>
                    <div className="font-semibold">{itemName}</div>
                    <div className="text-xs text-muted-foreground">
                      {itemType}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold tabular-nums">
                      {formatMoney(Number(item.unitPrice))} / {item.unit}
                    </div>
                    <ToneBadge tone={trendTone}>{trend}</ToneBadge>
                  </TableCell>
                  <TableCell>
                    {lastOrder ? (
                      <>
                        <div className="tabular-nums">
                          {formatMoney(Number(lastOrder.unitPrice))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          PO #{lastOrder.purchaseOrder.orderNumber}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        No order history
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={item.isActive} />
                  </TableCell>
                  <TableCell>
                    <form
                      action={updateSupplierCatalogItem}
                      className="grid min-w-64 gap-3 sm:grid-cols-2"
                    >
                      <Input type="hidden" name="supplierId" value={supplierId} />
                      <Input
                        type="hidden"
                        name="catalogItemId"
                        value={item.id}
                      />
                      <div className="grid gap-1.5">
                        <Label htmlFor={`catalog-${item.id}-unit`}>Unit</Label>
                        <Input
                          id={`catalog-${item.id}-unit`}
                          name="unit"
                          defaultValue={item.unit}
                          maxLength={40}
                          required
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`catalog-${item.id}-price`}>Price</Label>
                        <Input
                          id={`catalog-${item.id}-price`}
                          name="unitPrice"
                          type="number"
                          min="0"
                          max="9999999999.99"
                          step="0.01"
                          defaultValue={Number(item.unitPrice).toFixed(2)}
                          required
                        />
                      </div>
                      <Input type="hidden" name="isActive" value="false" />
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Input
                          type="checkbox"
                          name="isActive"
                          value="true"
                          defaultChecked={item.isActive}
                          className="size-4"
                        />
                        Active
                      </label>
                      <Button type="submit" size="sm">
                        Save item
                      </Button>
                    </form>
                  </TableCell>
                </tr>
              );
            })
          ) : (
            <tr>
              <TableCell colSpan={5}>
                No catalog items have been assigned.
              </TableCell>
            </tr>
          )}
        </tbody>
      </Table>
    </DataTableCard>
  );
}

export default async function SupplierCatalogPage({
  params,
  searchParams,
}: SupplierCatalogPageProps) {
  const currentUser = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [supplier, products, supplies] = await Promise.all([
    prisma.supplier.findUnique({
      where: { id },
      include: {
        catalogItems: {
          include: {
            product: { select: { id: true, name: true } },
            inventorySupply: { select: { id: true, name: true, unit: true } },
            purchaseOrderItems: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                unitPrice: true,
                purchaseOrder: { select: { orderNumber: true } },
              },
            },
          },
        },
        bills: {
          where: { status: { in: ["UNPAID", "PARTIAL"] } },
          select: { totalAmount: true, paidAmount: true },
        },
        payments: {
          include: {
            allocations: {
              include: {
                bill: {
                  select: {
                    invoice: { select: { id: true, invoiceNumber: true } },
                    _count: { select: { installments: true } },
                  },
                },
              },
              orderBy: { allocatedAt: "asc" },
            },
            recordedBy: { select: { fullName: true } },
            dailyCashPayment: {
              include: {
                dailyCashDay: { select: { businessDate: true } },
              },
            },
          },
          orderBy: [{ paidAt: "desc" }, { id: "desc" }],
        },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.inventorySupply.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
  ]);
  if (!supplier) notFound();

  const assignedProducts = new Set<string>();
  const assignedSupplies = new Set<string>();
  for (const item of supplier.catalogItems) {
    if (item.productId) assignedProducts.add(item.productId);
    if (item.inventorySupplyId) assignedSupplies.add(item.inventorySupplyId);
  }
  const availableProducts: Array<{
    id: string;
    name: string;
    suggestedUnit: string;
  }> = [];
  for (const item of products) {
    if (!assignedProducts.has(item.id)) {
      availableProducts.push({ ...item, suggestedUnit: "unit" });
    }
  }
  const availableSupplies: Array<{
    id: string;
    name: string;
    suggestedUnit: string;
  }> = [];
  for (const item of supplies) {
    if (!assignedSupplies.has(item.id)) {
      availableSupplies.push({ ...item, suggestedUnit: item.unit });
    }
  }
  const rows = [...supplier.catalogItems].sort((left, right) => {
    const leftName = left.product?.name ?? left.inventorySupply?.name ?? "";
    const rightName = right.product?.name ?? right.inventorySupply?.name ?? "";
    return leftName.localeCompare(rightName);
  });
  const activeCount = rows.filter((item) => item.isActive).length;
  const changedCount = rows.filter((item) => {
    const lastPrice = item.purchaseOrderItems[0]?.unitPrice;
    const trend = getSupplierCatalogPriceTrend(item.unitPrice, lastPrice);
    return trend === "increased" || trend === "decreased";
  }).length;
  const outstanding = supplier.bills.reduce(
    (sum, bill) => sum + Number(bill.totalAmount) - Number(bill.paidAmount),
    0,
  );
  const totalCashPaid = supplier.payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const credit = supplier.payments.reduce(
    (sum, payment) =>
      sum +
      Number(payment.amount) -
      payment.allocations.reduce(
        (allocationSum, allocation) =>
          allocationSum + Number(allocation.amount),
        0,
      ),
    0,
  );
  const notice = statusNotice(query?.catalogStatus);

  return (
    <AdminPage
      title={`${supplier.name} catalog`}
      description="Choose what this supplier sells, maintain current prices, and compare them with the latest purchase order."
      action={
        <>
          <Button asChild>
            <Link
              href={`/admin/supplier-purchase-orders/new?supplier=${encodeURIComponent(supplier.id)}`}
            >
              Create purchase order
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/suppliers">Back to suppliers</Link>
          </Button>
        </>
      }
    >
      {notice ? (
        <ToastOnMount
          tone={notice.tone as "success" | "error"}
          title={notice.tone === "error" ? "Catalog not changed" : "Catalog updated"}
          description={notice.message}
        />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Catalog items" value={rows.length} />
        <MetricCard label="Active items" value={activeCount} />
        <MetricCard
          label="Prices changed since last order"
          value={changedCount}
        />
      </section>

      <SupplierAccountSection
        supplierId={supplier.id}
        outstanding={outstanding}
        credit={credit}
        totalCashPaid={totalCashPaid}
        currentUser={currentUser}
        payments={supplier.payments}
      />

      <Card className="p-5">
        <div className="mb-4">
          <h2 className="font-semibold">Add catalog item</h2>
          <p className="text-sm text-muted-foreground">
            Only active products and inventory supplies not already assigned are
            shown.
          </p>
        </div>
        <CatalogItemCreateForm
          supplierId={supplier.id}
          products={availableProducts}
          supplies={availableSupplies}
        />
      </Card>

      <SupplierCatalogTable rows={rows} supplierId={supplier.id} />
    </AdminPage>
  );
}
