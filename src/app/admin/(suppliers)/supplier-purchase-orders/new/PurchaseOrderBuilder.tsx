"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createSupplierPurchaseOrder } from "../actions";

type SupplierOption = { id: string; name: string };
type CatalogItem = {
  id: string;
  name: string;
  unit: string;
  unitPrice: string;
};
type OrderRow = { key: number; catalogItemId: string; quantity: string };

function scaledInteger(value: string, decimals: number) {
  const input = value.trim();
  const pattern =
    decimals === 3
      ? /^(?:0|[1-9]\d*)(?:\.(\d{0,3}))?$/
      : /^(?:0|[1-9]\d*)(?:\.(\d{0,2}))?$/;
  const match = input.match(pattern);
  if (!match) return null;
  const [whole] = input.split(".");
  const fraction = (match[1] ?? "").padEnd(decimals, "0");
  return (
    BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(fraction || "0")
  );
}

function lineTotalCents(quantity: string, unitPrice: string) {
  const quantityThousandths = scaledInteger(quantity, 3);
  const priceCents = scaledInteger(unitPrice, 2);
  if (quantityThousandths === null || priceCents === null) return BigInt(0);
  return (quantityThousandths * priceCents + BigInt(500)) / BigInt(1000);
}

function formatCents(value: bigint) {
  const dollars = value / BigInt(100);
  const cents = (value % BigInt(100)).toString().padStart(2, "0");
  return `$${dollars.toLocaleString("en-US")}.${cents}`;
}

export default function PurchaseOrderBuilder({
  suppliers,
  selectedSupplier,
  catalogItems,
  todayDateKey,
  defaultDeliveryDateKey,
}: {
  suppliers: SupplierOption[];
  selectedSupplier: SupplierOption | null;
  catalogItems: CatalogItem[];
  todayDateKey: string;
  defaultDeliveryDateKey: string;
}) {
  const router = useRouter();
  const nextKey = useRef(2);
  const [rows, setRows] = useState<OrderRow[]>([
    { key: 1, catalogItemId: "", quantity: "1" },
  ]);
  const catalogById = useMemo(
    () => new Map(catalogItems.map((item) => [item.id, item])),
    [catalogItems],
  );
  const selectedIds = new Set(
    rows.flatMap((row) => (row.catalogItemId ? [row.catalogItemId] : [])),
  );
  const orderTotal = rows.reduce((total, row) => {
    const item = catalogById.get(row.catalogItemId);
    return (
      total + (item ? lineTotalCents(row.quantity, item.unitPrice) : BigInt(0))
    );
  }, BigInt(0));

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="grid gap-2 sm:max-w-xl">
          <Label htmlFor="purchase-order-supplier">Supplier</Label>
          <NativeSelect
            id="purchase-order-supplier"
            value={selectedSupplier?.id ?? ""}
            onChange={(event) => {
              const supplierId = event.target.value;
              router.replace(
                supplierId
                  ? `/admin/supplier-purchase-orders/new?supplier=${encodeURIComponent(supplierId)}`
                  : "/admin/supplier-purchase-orders/new",
              );
            }}
            className="w-full"
          >
            <option value="">Select a supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </Card>

      {selectedSupplier ? (
        catalogItems.length ? (
          <form action={createSupplierPurchaseOrder} className="space-y-6">
            <Input
              type="hidden"
              name="supplierId"
              value={selectedSupplier.id}
            />
            <Card className="overflow-hidden p-0">
              <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">
                    {selectedSupplier.name} order items
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Prices are read from the current supplier catalog and
                    verified again when submitted.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const key = nextKey.current;
                    nextKey.current += 1;
                    setRows((current) => [
                      ...current,
                      { key, catalogItemId: "", quantity: "1" },
                    ]);
                  }}
                  disabled={rows.length >= catalogItems.length}
                >
                  <Plus /> Add row
                </Button>
              </div>
              <Table>
                <thead>
                  <tr>
                    <TableHead>Item</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Line total</TableHead>
                    <TableHead>
                      <span className="sr-only">Remove</span>
                    </TableHead>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const item = catalogById.get(row.catalogItemId);
                    return (
                      <tr key={row.key} className="border-t">
                        <TableCell>
                          <NativeSelect
                            name="catalogItemId"
                            value={row.catalogItemId}
                            onChange={(event) => {
                              const value = event.target.value;
                              setRows((current) =>
                                current.map((entry) =>
                                  entry.key === row.key
                                    ? { ...entry, catalogItemId: value }
                                    : entry,
                                ),
                              );
                            }}
                            required
                            className="w-full min-w-52"
                          >
                            <option value="">Select item</option>
                            {catalogItems.map((option) => (
                              <option
                                key={option.id}
                                value={option.id}
                                disabled={
                                  option.id !== row.catalogItemId &&
                                  selectedIds.has(option.id)
                                }
                              >
                                {option.name}
                              </option>
                            ))}
                          </NativeSelect>
                        </TableCell>
                        <TableCell>{item?.unit ?? "--"}</TableCell>
                        <TableCell className="tabular-nums">
                          {item
                            ? formatCents(
                                scaledInteger(item.unitPrice, 2) ?? BigInt(0),
                              )
                            : "--"}
                        </TableCell>
                        <TableCell>
                          <Input
                            name="quantity"
                            type="number"
                            min="0.1"
                            max="99999"
                            step="0.001"
                            value={row.quantity}
                            onChange={(event) => {
                              const value = event.target.value;
                              setRows((current) =>
                                current.map((entry) =>
                                  entry.key === row.key
                                    ? { ...entry, quantity: value }
                                    : entry,
                                ),
                              );
                            }}
                            className="min-w-28"
                            required
                          />
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums">
                          {item
                            ? formatCents(
                                lineTotalCents(row.quantity, item.unitPrice),
                              )
                            : "--"}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Remove order row"
                            disabled={rows.length === 1}
                            onClick={() => {
                              setRows((current) =>
                                current.filter(
                                  (entry) => entry.key !== row.key,
                                ),
                              );
                            }}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </TableCell>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <div className="flex justify-end border-t bg-muted/30 px-5 py-4">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">
                    Order total
                  </div>
                  <output className="text-2xl font-semibold tabular-nums">
                    {formatCents(orderTotal)}
                  </output>
                </div>
              </div>
            </Card>

            <Card className="grid gap-5 p-5 lg:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="expected-delivery-date">
                  Expected delivery date
                </Label>
                <Input
                  id="expected-delivery-date"
                  name="expectedDeliveryDate"
                  type="date"
                  min={todayDateKey}
                  defaultValue={defaultDeliveryDateKey}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="purchase-order-notes">Order notes</Label>
                <Textarea
                  id="purchase-order-notes"
                  name="notes"
                  maxLength={2000}
                  placeholder="Optional delivery instructions or phone-call notes"
                />
              </div>
              <div className="flex flex-wrap gap-3 lg:col-span-2 lg:justify-end">
                <Button asChild type="button" variant="outline">
                  <Link href={`/admin/suppliers/${selectedSupplier.id}`}>
                    Manage supplier catalog
                  </Link>
                </Button>
                <Button type="submit">Create purchase order</Button>
              </div>
            </Card>
          </form>
        ) : (
          <Card className="p-6 text-center">
            <h2 className="font-semibold">No active catalog items</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add or reactivate items before creating an order for{" "}
              {selectedSupplier.name}.
            </p>
            <Button asChild className="mt-4">
              <Link href={`/admin/suppliers/${selectedSupplier.id}`}>
                Manage catalog
              </Link>
            </Button>
          </Card>
        )
      ) : (
        <Card className="p-6 text-center text-muted-foreground">
          Select a supplier to load the items and prices it currently offers.
        </Card>
      )}
    </div>
  );
}
