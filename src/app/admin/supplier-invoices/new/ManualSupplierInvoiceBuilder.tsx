"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createManualSupplierInvoiceDraftAction } from "../actions";

type SupplierOption = { id: string; name: string };
type CatalogItem = { id: string; name: string; unit: string; unitPrice: string };
type InvoiceRow = {
  key: number;
  catalogItemId: string;
  quantity: string;
  unitPrice: string;
  notes: string;
};

const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function lineTotal(quantity: string, unitPrice: string) {
  const parsedQuantity = Number(quantity);
  const parsedUnitPrice = Number(unitPrice);
  if (!Number.isFinite(parsedQuantity) || !Number.isFinite(parsedUnitPrice)) {
    return 0;
  }
  return Math.round((parsedQuantity * parsedUnitPrice + Number.EPSILON) * 100) / 100;
}

export default function ManualSupplierInvoiceBuilder({
  suppliers,
  selectedSupplier,
  catalogItems,
  todayDateKey,
  defaultDueDateKey,
}: {
  suppliers: SupplierOption[];
  selectedSupplier: SupplierOption | null;
  catalogItems: CatalogItem[];
  todayDateKey: string;
  defaultDueDateKey: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const nextKey = useRef(2);
  const [rows, setRows] = useState<InvoiceRow[]>([
    { key: 1, catalogItemId: "", quantity: "1", unitPrice: "", notes: "" },
  ]);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [pending, startTransition] = useTransition();
  const catalogById = useMemo(
    () => new Map(catalogItems.map((item) => [item.id, item])),
    [catalogItems],
  );
  const selectedCatalogIds = new Set(
    rows.flatMap((row) => (row.catalogItemId ? [row.catalogItemId] : [])),
  );
  const total = rows.reduce(
    (sum, row) => sum + lineTotal(row.quantity, row.unitPrice),
    0,
  );

  function updateRow(key: number, patch: Partial<InvoiceRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  if (!selectedSupplier) {
    return (
      <Card className="p-5">
        <div className="grid gap-2 sm:max-w-xl">
          <Label htmlFor="invoice-supplier">Supplier</Label>
          <NativeSelect
            id="invoice-supplier"
            value=""
            onChange={(event) => {
              const supplierId = event.target.value;
              router.replace(
                supplierId
                  ? `/admin/supplier-invoices/new?supplier=${encodeURIComponent(supplierId)}`
                  : "/admin/supplier-invoices/new",
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
          <p className="text-sm text-muted-foreground">
            Select an active supplier to load its catalog items.
          </p>
        </div>
      </Card>
    );
  }

  if (!catalogItems.length) {
    return (
      <div className="space-y-6">
        <Card className="p-5">
          <div className="grid gap-2 sm:max-w-xl">
            <Label htmlFor="invoice-supplier">Supplier</Label>
            <NativeSelect
              id="invoice-supplier"
              value={selectedSupplier.id}
              onChange={(event) => {
                const supplierId = event.target.value;
                router.replace(
                  supplierId
                    ? `/admin/supplier-invoices/new?supplier=${encodeURIComponent(supplierId)}`
                    : "/admin/supplier-invoices/new",
                );
              }}
              className="w-full"
            >
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </Card>
        <Card className="p-6 text-center">
          <h2 className="font-semibold">No active catalog items</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add or reactivate catalog items before creating an invoice for {selectedSupplier.name}.
          </p>
          <Button asChild className="mt-4">
            <Link href={`/admin/suppliers/${selectedSupplier.id}`}>Manage supplier catalog</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="grid gap-2 sm:max-w-xl">
          <Label htmlFor="invoice-supplier">Supplier</Label>
          <NativeSelect
            id="invoice-supplier"
            value={selectedSupplier.id}
            onChange={(event) => {
              const supplierId = event.target.value;
              router.replace(
                supplierId
                  ? `/admin/supplier-invoices/new?supplier=${encodeURIComponent(supplierId)}`
                  : "/admin/supplier-invoices/new",
              );
            }}
            className="w-full"
            disabled={pending}
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

      <form
        ref={formRef}
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          const form = formRef.current;
          if (!form) return;
          const data = new FormData(form);
          setMessage("");
          startTransition(async () => {
            try {
              const result = await createManualSupplierInvoiceDraftAction(data);
              setHasError(false);
              setMessage(result.message);
              router.push(result.redirectTo);
            } catch (error) {
              setHasError(true);
              setMessage(
                error instanceof Error ? error.message : "Invoice draft could not be created.",
              );
            }
          });
        }}
      >
        <Input type="hidden" name="supplierId" value={selectedSupplier.id} />

        <Card className="grid gap-4 p-5 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="invoiceNumber">Invoice number</Label>
            <Input id="invoiceNumber" name="invoiceNumber" maxLength={200} placeholder="Supplier invoice number" disabled={pending} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invoiceDate">Invoice date</Label>
            <Input id="invoiceDate" name="invoiceDate" type="date" defaultValue={todayDateKey} required disabled={pending} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dueDate">Due date</Label>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={defaultDueDateKey} required disabled={pending} />
          </div>
          <div className="grid gap-2 md:col-span-3">
            <Label htmlFor="notes">Invoice notes</Label>
            <Textarea id="notes" name="notes" maxLength={2000} rows={3} placeholder="Optional notes for this invoice" disabled={pending} />
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Invoice items</h2>
              <p className="text-sm text-muted-foreground">Items must come from this supplier’s active catalog.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={pending || rows.length >= Math.min(catalogItems.length, 100)}
              onClick={() => {
                const key = nextKey.current;
                nextKey.current += 1;
                setRows((current) => [
                  ...current,
                  { key, catalogItemId: "", quantity: "1", unitPrice: "", notes: "" },
                ]);
              }}
            >
              <Plus /> Add item
            </Button>
          </div>
          <Table>
            <thead>
              <tr>
                <TableHead>Item</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit price</TableHead>
                <TableHead>Line total</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead><span className="sr-only">Remove</span></TableHead>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const item = catalogById.get(row.catalogItemId);
                return (
                  <tr key={row.key} className="border-t align-top">
                    <TableCell>
                      <NativeSelect
                        name="catalogItemId"
                        value={row.catalogItemId}
                        required
                        disabled={pending}
                        className="min-w-52"
                        onChange={(event) => {
                          const catalogItemId = event.target.value;
                          updateRow(row.key, {
                            catalogItemId,
                            unitPrice: catalogById.get(catalogItemId)?.unitPrice ?? "",
                          });
                        }}
                      >
                        <option value="">Select item</option>
                        {catalogItems.map((option) => (
                          <option
                            key={option.id}
                            value={option.id}
                            disabled={option.id !== row.catalogItemId && selectedCatalogIds.has(option.id)}
                          >
                            {option.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell>{item?.unit ?? "--"}</TableCell>
                    <TableCell>
                      <Input name="quantity" type="number" min="0.001" max="999999999.999" step="0.001" value={row.quantity} required disabled={pending} className="min-w-28" onChange={(event) => updateRow(row.key, { quantity: event.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input name="unitPrice" type="number" min="0" max="9999999999.99" step="0.01" value={row.unitPrice} required disabled={pending} className="min-w-32" onChange={(event) => updateRow(row.key, { unitPrice: event.target.value })} />
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">{MONEY.format(lineTotal(row.quantity, row.unitPrice))}</TableCell>
                    <TableCell>
                      <Input name="lineNotes" maxLength={1000} value={row.notes} disabled={pending} className="min-w-40" onChange={(event) => updateRow(row.key, { notes: event.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove invoice item" disabled={pending || rows.length === 1} onClick={() => setRows((current) => current.filter((entry) => entry.key !== row.key))}>
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
              <div className="text-sm text-muted-foreground">Invoice total</div>
              <output className="text-2xl font-semibold tabular-nums">{MONEY.format(total)}</output>
            </div>
          </div>
        </Card>

        {message ? (
          <Alert variant={hasError ? "destructive" : "default"}>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>{pending ? "Creating..." : "Create invoice draft"}</Button>
        </div>
      </form>
    </div>
  );
}
