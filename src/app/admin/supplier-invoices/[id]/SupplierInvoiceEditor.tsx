"use client";

import { type FormEvent, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  finalizeSupplierInvoiceAction,
  saveSupplierInvoiceDraftAction,
  voidSupplierInvoiceDraftAction,
} from "../actions";

type CatalogOption = {
  id: string;
  itemName: string;
  itemUnit: string;
  unitPrice: string;
  isActive: boolean;
};

type EditorLine = {
  key: string;
  kind: "catalog" | "custom";
  catalogItemId: string;
  itemName: string;
  itemUnit: string;
  quantity: string;
  unitPrice: string;
  notes: string;
};

type EditorInstallment = {
  key: string;
  id: string;
  dueDate: string;
  amount: string;
};

type InvoiceEditorData = {
  id: string;
  status: "DRAFT" | "FINALIZED" | "VOID";
  invoiceNumber: string;
  supplierReference: string;
  invoiceDate: string;
  dueDate: string;
  notes: string;
  items: EditorLine[];
  installments: Array<Omit<EditorInstallment, "key">>;
};

type InvoiceAction = (data: FormData) => Promise<{
  message: string;
  redirectTo?: string;
}>;

const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function calculatedLineTotal(line: EditorLine) {
  const quantity = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  return Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100;
}

function preventSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
}

type InvoiceDetailsSectionProps = {
  invoice: InvoiceEditorData;
  editable: boolean;
  pending: boolean;
};

function InvoiceDetailsSection({
  invoice,
  editable,
  pending,
}: InvoiceDetailsSectionProps) {
  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-2 lg:grid-cols-4">
      <div className="grid gap-2">
        <Label htmlFor="invoiceNumber">Invoice number</Label>
        <Input
          id="invoiceNumber"
          value={invoice.invoiceNumber}
          disabled
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="supplierReference">Supplier reference</Label>
        <Input
          id="supplierReference"
          name="supplierReference"
          defaultValue={invoice.supplierReference}
          maxLength={200}
          disabled={!editable || pending}
          placeholder="Optional supplier invoice number"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="invoiceDate">Invoice date</Label>
        <Input
          required
          id="invoiceDate"
          name="invoiceDate"
          type="date"
          defaultValue={invoice.invoiceDate}
          disabled={!editable || pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="dueDate">Due date</Label>
        <Input
          required
          id="dueDate"
          name="dueDate"
          type="date"
          defaultValue={invoice.dueDate}
          disabled={!editable || pending}
        />
      </div>
      <div className="grid gap-2 md:col-span-2 lg:col-span-4">
        <Label htmlFor="notes">Invoice notes</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={invoice.notes}
          disabled={!editable || pending}
          rows={3}
          placeholder="Optional notes for this invoice"
        />
      </div>
    </section>
  );
}

type InvoiceInstallmentsSectionProps = {
  installments: EditorInstallment[];
  invoiceTotal: number;
  scheduledTotal: number;
  pending: boolean;
  onAddInstallment: () => void;
  onChangeInstallment: (
    index: number,
    patch: Partial<EditorInstallment>,
  ) => void;
  onRemoveInstallment: (index: number) => void;
};

function InvoiceInstallmentsSection({
  installments,
  invoiceTotal,
  scheduledTotal,
  pending,
  onAddInstallment,
  onChangeInstallment,
  onRemoveInstallment,
}: InvoiceInstallmentsSectionProps) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Payment installments</h2>
          <p className="text-sm text-muted-foreground">
            Schedule the exact amount and due date for each supplier payment.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onAddInstallment}
        >
          <Plus className="size-4" /> Add installment
        </Button>
      </div>
      <div className="grid gap-2 text-sm font-medium sm:grid-cols-[1fr_1fr_auto]">
        <span>Due date</span>
        <span>Amount</span>
        <span className="sr-only">Remove</span>
      </div>
      {installments.map((installment, index) => (
        <div
          key={installment.key}
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        >
          <Input type="hidden" name="installmentId" value={installment.id} />
          <Input
            required
            name="installmentDueDate"
            type="date"
            value={installment.dueDate}
            disabled={pending}
            onChange={(event) =>
              onChangeInstallment(index, { dueDate: event.target.value })
            }
          />
          <Input
            required
            name="installmentAmount"
            type="number"
            min="0.01"
            step="0.01"
            value={installment.amount}
            disabled={pending}
            onChange={(event) =>
              onChangeInstallment(index, { amount: event.target.value })
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending || installments.length === 1}
            onClick={() => onRemoveInstallment(index)}
            aria-label={`Remove installment ${index + 1}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <span>
          Invoice total <strong>{MONEY.format(invoiceTotal)}</strong>
        </span>
        <span>
          Scheduled <strong>{MONEY.format(scheduledTotal)}</strong>
        </span>
        <span
          className={
            Math.abs(invoiceTotal - scheduledTotal) < 0.005
              ? "text-emerald-700"
              : "text-destructive"
          }
        >
          Difference {MONEY.format(invoiceTotal - scheduledTotal)}
        </span>
      </div>
    </section>
  );
}

type CatalogLinePickerProps = {
  catalog: CatalogOption[];
  selectedCatalogId: string;
  selectedCatalogIds: Set<string>;
  pending: boolean;
  onAddCatalogLine: () => void;
  onAddCustomLine: () => void;
  allowCustomLines: boolean;
  onSelectedCatalogIdChange: (value: string) => void;
};

function CatalogLinePicker({
  catalog,
  selectedCatalogId,
  selectedCatalogIds,
  pending,
  onAddCatalogLine,
  onAddCustomLine,
  allowCustomLines,
  onSelectedCatalogIdChange,
}: CatalogLinePickerProps) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-end">
      <div className="grid min-w-0 flex-1 gap-2">
        <Label htmlFor="catalogItem">Add an item from this supplier</Label>
        <NativeSelect
          id="catalogItem"
          value={selectedCatalogId}
          onChange={(event) => onSelectedCatalogIdChange(event.target.value)}
          className="w-full"
          disabled={pending}
        >
          <option value="">Choose a catalog item</option>
          {catalog.map((item) => (
            <option
              key={item.id}
              value={item.id}
              disabled={!item.isActive || selectedCatalogIds.has(item.id)}
            >
              {item.itemName} · {item.itemUnit} ·{" "}
              {MONEY.format(Number(item.unitPrice))}
              {item.isActive ? "" : " · inactive"}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onAddCatalogLine}
        disabled={!selectedCatalogId || pending}
      >
        <Plus data-icon="inline-start" />
        Add catalog item
      </Button>
      {allowCustomLines ? (
        <Button
          type="button"
          variant="outline"
          onClick={onAddCustomLine}
          disabled={pending}
        >
          <Plus data-icon="inline-start" />
          Add custom line
        </Button>
      ) : null}
    </section>
  );
}

type InvoiceItemsSectionProps = {
  lines: EditorLine[];
  editable: boolean;
  pending: boolean;
  total: number;
  onLineChange: (key: string, patch: Partial<EditorLine>) => void;
  onRemoveLine: (key: string) => void;
};

function InvoiceItemsSection({
  lines,
  editable,
  pending,
  total,
  onLineChange,
  onRemoveLine,
}: InvoiceItemsSectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">Invoice items</h2>
        <p className="text-sm text-muted-foreground">
          Catalog prices are invoice snapshots. Editing them here does not
          change the supplier catalog.
        </p>
      </div>
      <div className="divide-y">
        {lines.map((line, index) => (
          <InvoiceItemRow
            key={line.key}
            line={line}
            index={index}
            editable={editable}
            pending={pending}
            onLineChange={onLineChange}
            onRemoveLine={onRemoveLine}
          />
        ))}
        {!lines.length ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Add at least one invoice item before saving.
          </p>
        ) : null}
      </div>
      <div className="flex justify-end border-t bg-muted/30 p-5">
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            Calculated invoice total
          </p>
          <p className="text-3xl font-semibold tabular-nums">
            {MONEY.format(total)}
          </p>
        </div>
      </div>
    </section>
  );
}

type InvoiceItemRowProps = {
  line: EditorLine;
  index: number;
  editable: boolean;
  pending: boolean;
  onLineChange: (key: string, patch: Partial<EditorLine>) => void;
  onRemoveLine: (key: string) => void;
};

function InvoiceItemRow({
  line,
  index,
  editable,
  pending,
  onLineChange,
  onRemoveLine,
}: InvoiceItemRowProps) {
  return (
    <div className="grid gap-4 p-5 lg:grid-cols-12 lg:items-end">
      <Input type="hidden" name="lineKind" value={line.kind} />
      <Input type="hidden" name="catalogItemId" value={line.catalogItemId} />
      <div className="grid gap-2 lg:col-span-3">
        <Label htmlFor={`itemName-${line.key}`}>Description</Label>
        <Input
          required
          id={`itemName-${line.key}`}
          name="itemName"
          value={line.itemName}
          onChange={(event) =>
            onLineChange(line.key, { itemName: event.target.value })
          }
          readOnly={line.kind === "catalog"}
          disabled={!editable || pending}
        />
      </div>
      <div className="grid gap-2 lg:col-span-2">
        <Label htmlFor={`itemUnit-${line.key}`}>Unit</Label>
        <Input
          required
          id={`itemUnit-${line.key}`}
          name="itemUnit"
          value={line.itemUnit}
          onChange={(event) =>
            onLineChange(line.key, { itemUnit: event.target.value })
          }
          readOnly={line.kind === "catalog"}
          disabled={!editable || pending}
        />
      </div>
      <div className="grid gap-2 lg:col-span-2">
        <Label htmlFor={`quantity-${line.key}`}>Quantity</Label>
        <Input
          required
          id={`quantity-${line.key}`}
          name="quantity"
          type="number"
          min="0.001"
          step="0.001"
          value={line.quantity}
          onChange={(event) =>
            onLineChange(line.key, { quantity: event.target.value })
          }
          disabled={!editable || pending}
        />
      </div>
      <div className="grid gap-2 lg:col-span-2">
        <Label htmlFor={`unitPrice-${line.key}`}>Unit price</Label>
        <Input
          required
          id={`unitPrice-${line.key}`}
          name="unitPrice"
          type="number"
          min="0"
          step="0.01"
          value={line.unitPrice}
          onChange={(event) =>
            onLineChange(line.key, { unitPrice: event.target.value })
          }
          disabled={!editable || pending}
        />
      </div>
      <div className="lg:col-span-2">
        <Label>Line total</Label>
        <p className="mt-2 font-semibold tabular-nums">
          {MONEY.format(calculatedLineTotal(line))}
        </p>
      </div>
      <div className="flex justify-end lg:col-span-1">
        {editable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove invoice item ${index + 1}`}
            onClick={() => onRemoveLine(line.key)}
            disabled={pending}
          >
            <Trash2 className="text-destructive" />
          </Button>
        ) : null}
      </div>
      <div className="grid gap-2 lg:col-span-12">
        <Label htmlFor={`lineNotes-${line.key}`}>Line notes</Label>
        <Input
          id={`lineNotes-${line.key}`}
          name="lineNotes"
          value={line.notes}
          onChange={(event) =>
            onLineChange(line.key, { notes: event.target.value })
          }
          disabled={!editable || pending}
          placeholder="Optional"
        />
      </div>
    </div>
  );
}

function InvoiceStatusMessage({
  message,
  hasError,
}: {
  message: string;
  hasError: boolean;
}) {
  if (!message) return null;

  return (
    <Alert variant={hasError ? "destructive" : "default"}>
      <AlertDescription role="status">{message}</AlertDescription>
    </Alert>
  );
}

type InvoiceActionsSectionProps = {
  pending: boolean;
  hasPurchaseOrder: boolean;
  onRunAction: (action: InvoiceAction, confirmation?: string) => void;
};

function InvoiceActionsSection({
  pending,
  hasPurchaseOrder,
  onRunAction,
}: InvoiceActionsSectionProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => onRunAction(saveSupplierInvoiceDraftAction)}
        >
          {pending ? "Working..." : "Save draft"}
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            onRunAction(
              finalizeSupplierInvoiceAction,
              "Finalize this invoice and create the unpaid supplier bill? The invoice will become read-only.",
            )
          }
        >
          Finalize invoice
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(16rem,1fr)_auto] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="voidReason">Void reason</Label>
          <Input
            id="voidReason"
            name="voidReason"
            placeholder="Optional audit note"
            disabled={pending}
          />
        </div>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            onRunAction(
              voidSupplierInvoiceDraftAction,
              hasPurchaseOrder
                ? "Void this invoice and reopen its linked purchase order?"
                : "Void this invoice?",
            )
          }
        >
          {hasPurchaseOrder ? "Void & reopen PO" : "Void invoice"}
        </Button>
      </div>
    </section>
  );
}

export default function SupplierInvoiceEditor({
  invoice: initialInvoice,
  catalog,
  hasPurchaseOrder,
  source,
}: {
  invoice: InvoiceEditorData;
  catalog: CatalogOption[];
  hasPurchaseOrder: boolean;
  source: "PURCHASE_ORDER" | "MANUAL" | "LEGACY_UPLOAD";
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const invoice = initialInvoice;
  const [lines, setLines] = useState(initialInvoice.items);
  const [installments, setInstallments] = useState<EditorInstallment[]>(
    initialInvoice.installments.length
      ? initialInvoice.installments.map((installment) => ({
          ...installment,
          key:
            installment.id ||
            `existing-installment-${installment.dueDate}-${installment.amount}`,
        }))
      : [
          {
            id: "",
            key: "default-installment",
            dueDate: initialInvoice.dueDate,
            amount: lines
              .reduce((sum, line) => sum + calculatedLineTotal(line), 0)
              .toFixed(2),
          },
        ],
  );
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [pending, startTransition] = useTransition();
  const editable = invoice.status === "DRAFT";
  const selectedCatalogIds = new Set(
    lines.flatMap((line) =>
      line.kind === "catalog" ? [line.catalogItemId] : [],
    ),
  );
  const total = lines.reduce((sum, line) => sum + calculatedLineTotal(line), 0);
  const scheduledTotal = installments.reduce(
    (sum, installment) => sum + (Number(installment.amount) || 0),
    0,
  );

  function updateInstallment(
    index: number,
    patch: Partial<EditorInstallment>,
  ) {
    setInstallments((current) =>
      current.map((installment, row) =>
        row === index ? { ...installment, ...patch } : installment,
      ),
    );
  }

  function addInstallment() {
    setInstallments((current) => [
      ...current,
      {
        id: "",
        key: `installment-${Date.now()}-${current.length}`,
        dueDate: current.at(-1)?.dueDate || invoice.dueDate,
        amount: "0.00",
      },
    ]);
  }

  function removeInstallment(index: number) {
    setInstallments((current) =>
      current.filter((_, row) => row !== index),
    );
  }

  function updateLine(key: string, patch: Partial<EditorLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function addCatalogLine() {
    const item = catalog.find((row) => row.id === selectedCatalogId);
    if (!item || selectedCatalogIds.has(item.id)) return;
    setLines((current) => [
      ...current,
      {
        key: `catalog-${item.id}`,
        kind: "catalog",
        catalogItemId: item.id,
        itemName: item.itemName,
        itemUnit: item.itemUnit,
        quantity: "1",
        unitPrice: item.unitPrice,
        notes: "",
      },
    ]);
    setSelectedCatalogId("");
  }

  function addCustomLine() {
    setLines((current) => [
      ...current,
      {
        key: `custom-${Date.now()}-${current.length}`,
        kind: "custom",
        catalogItemId: "",
        itemName: "",
        itemUnit: "unit",
        quantity: "1",
        unitPrice: "0.00",
        notes: "",
      },
    ]);
  }

  function runAction(action: InvoiceAction, confirmation?: string) {
    const form = formRef.current;
    if (!form || (confirmation && !window.confirm(confirmation))) return;
    const data = new FormData(form);
    setMessage("");
    startTransition(async () => {
      try {
        const result = await action(data);
        setHasError(false);
        setMessage(result.message);
        if (result.redirectTo) {
          router.push(result.redirectTo);
        } else {
          router.refresh();
        }
      } catch (error) {
        setHasError(true);
        setMessage(
          error instanceof Error ? error.message : "Invoice update failed.",
        );
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={preventSubmit} className="space-y-6">
      <Input type="hidden" name="invoiceId" value={invoice.id} />

      <InvoiceDetailsSection
        invoice={invoice}
        editable={editable}
        pending={pending}
      />

      {editable ? (
        <InvoiceInstallmentsSection
          installments={installments}
          invoiceTotal={total}
          scheduledTotal={scheduledTotal}
          pending={pending}
          onAddInstallment={addInstallment}
          onChangeInstallment={updateInstallment}
          onRemoveInstallment={removeInstallment}
        />
      ) : null}

      {editable ? (
        <CatalogLinePicker
          catalog={catalog}
          selectedCatalogId={selectedCatalogId}
          selectedCatalogIds={selectedCatalogIds}
          pending={pending}
          onAddCatalogLine={addCatalogLine}
          onAddCustomLine={addCustomLine}
          allowCustomLines={source !== "MANUAL"}
          onSelectedCatalogIdChange={setSelectedCatalogId}
        />
      ) : null}

      <InvoiceItemsSection
        lines={lines}
        editable={editable}
        pending={pending}
        total={total}
        onLineChange={updateLine}
        onRemoveLine={removeLine}
      />

      <InvoiceStatusMessage message={message} hasError={hasError} />

      {editable ? (
        <InvoiceActionsSection
          pending={pending}
          hasPurchaseOrder={hasPurchaseOrder}
          onRunAction={runAction}
        />
      ) : null}
    </form>
  );
}
