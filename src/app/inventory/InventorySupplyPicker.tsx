"use client";

import {
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import { Minus, Plus } from "lucide-react";
import { displayFont } from "@/components/customer/customer-order-styles";
import { Button } from "@/components/ui/button";
import SupplyCatalog, { type CatalogSupply } from "@/components/inventory/SupplyCatalog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { takeSupplyInventory } from "./actions";

type Supply = CatalogSupply & {
  stockUnit: string;
  step: string;
};

const reviewDescription = "Review the quantity to take out of stock.";
const reviewHeaderClass =
  "bg-[linear-gradient(145deg,#20140f_0%,#4a281a_42%,#8c5b34_100%)] p-5 text-white dark:bg-none dark:bg-secondary";

const desktopQuery = "(min-width: 1024px)";
function subscribeToDesktop(callback: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export default function InventorySupplyPicker({
  supplies,
  canTake,
  takeSupply,
}: {
  supplies: Supply[];
  canTake: boolean;
  takeSupply: typeof takeSupplyInventory;
}) {
  const { toast } = useToast();
  const reviewButton = useRef<HTMLButtonElement>(null);
  const requestInFlight = useRef(false);
  const isDesktop = useSyncExternalStore(
    subscribeToDesktop,
    () => window.matchMedia(desktopQuery).matches,
    () => true,
  );
  const [selection, setSelection] = useState<Pick<Supply, "id" | "stockUnit"> | null>(null);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [quantityError, setQuantityError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const selected = supplies.find(
    (supply) => supply.id === selection?.id && supply.stockUnit === selection.stockUnit,
  );
  const stockQty = Number(selected?.stockQty ?? 0);
  const canSubmit = canTake && selected?.hasUnitMapping && stockQty > 0;

  function selectSupply(supply: Supply | null) {
    if (requestInFlight.current || selected?.id === supply?.id) return;
    setSelection(supply ? { id: supply.id, stockUnit: supply.stockUnit } : null);
    setQuantity(supply && Number(supply.stockQty) >= 1 ? "1" : "");
    setNote("");
    setQuantityError("");
  }

  function editQuantity(value: string) {
    setQuantity(value);
    setQuantityError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current || !canSubmit) return;

    const form = event.currentTarget;
    const quantityInput = form.elements.namedItem("quantity") as HTMLInputElement;
    const { validity } = quantityInput;
    if (!validity.valid) {
      if (validity.rangeOverflow) {
        setQuantityError("Enter a quantity within the available stock.");
      } else if (validity.stepMismatch) {
        setQuantityError("Enter a quantity in increments of " + quantityInput.step + ".");
      } else {
        setQuantityError("Enter a quantity greater than zero.");
      }
      quantityInput.focus();
      return;
    }

    const data = new FormData(form);
    requestInFlight.current = true;
    startTransition(async () => {
      try {
        const result = await takeSupply(data);
        if (!result.ok) {
          if (result.field === "quantity") {
            setQuantityError(result.error);
          } else {
            toast({ tone: "error", description: result.error });
          }
          return;
        }

        setSelection(null);
        setQuantity("");
        setNote("");
        setSheetOpen(false);
        toast({
          tone: "success",
          title: "Supply taken",
          description:
            result.email === "sent"
              ? "Stock updated and the low-stock email was sent."
              : "Stock updated.",
        });
        if (result.email === "failed" || result.email === "skipped") {
          toast({
            tone: "warning",
            title: "Low-stock email unavailable",
            description: "Ask an admin to check the inventory email settings.",
          });
        }
      } catch {
        toast({
          tone: "error",
          description: "Could not confirm the withdrawal. Check Recent Taken before trying again.",
        });
      } finally {
        requestInFlight.current = false;
      }
    });
  }

  const review = selected ? (
    <SupplyReviewForm
      selected={selected}
      quantity={quantity}
      note={note}
      quantityError={quantityError}
      pending={pending}
      onQuantityChange={editQuantity}
      onNoteChange={setNote}
      onRemove={() => selectSupply(null)}
      onSubmit={submit}
    />
  ) : (
    <p className="border-border text-muted-foreground m-5 rounded-2xl border border-dashed p-6 text-center text-sm">
      Select a supply to enter the quantity and note.
    </p>
  );

  return (
    <div
      className={cn(
        "grid items-start gap-4",
        canTake && "lg:grid-cols-[minmax(0,1fr)_23rem] xl:grid-cols-[minmax(0,1fr)_25rem]",
      )}
    >
      <SupplyCatalog
        supplies={supplies}
        selectedId={selected?.id ?? null}
        pending={pending}
        onSelect={canTake ? selectSupply : undefined}
        canSelect={(supply) => supply.status !== "OUT" && supply.hasUnitMapping}
      />

      {canTake && isDesktop ? (
        <aside
          aria-label="Supply selection"
          className="border-border bg-card hidden overflow-hidden rounded-3xl border shadow-[0_22px_65px_rgba(44,28,17,0.14)] lg:sticky lg:top-20 lg:block"
        >
          <div className={reviewHeaderClass}>
            <h2 className="text-3xl" style={{ fontFamily: displayFont }}>
              Supply selection
            </h2>
            <p className="mt-1 text-sm text-white/80">{reviewDescription}</p>
          </div>
          {review}
        </aside>
      ) : null}

      {canTake && !isDesktop ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <div className="pointer-events-none fixed inset-x-3 bottom-4 z-30 flex justify-end lg:hidden">
            <Button
              ref={reviewButton}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className="pointer-events-auto h-11 rounded-full px-5 shadow-lg"
              onClick={() => setSheetOpen(true)}
            >
              Review selection ({selected ? 1 : 0})
            </Button>
          </div>
          <SheetContent
            className="bg-card gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md [&>[data-slot=sheet-close]]:text-white"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              reviewButton.current?.focus();
            }}
          >
            <SheetHeader className={cn(reviewHeaderClass, "pr-12")}>
              <SheetTitle className="text-3xl text-white" style={{ fontFamily: displayFont }}>
                Supply selection
              </SheetTitle>
              <SheetDescription className="text-white/80">{reviewDescription}</SheetDescription>
            </SheetHeader>
            {review}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

function SupplyReviewForm({
  selected,
  quantity,
  note,
  quantityError,
  pending,
  onQuantityChange,
  onNoteChange,
  onRemove,
  onSubmit: submit,
}: {
  selected: Supply;
  quantity: string;
  note: string;
  quantityError: string;
  pending: boolean;
  onQuantityChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onRemove: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const quantityId = useId();
  const quantityRef = useRef<HTMLInputElement>(null);
  const noteId = useId();
  const stockQty = Number(selected.stockQty);
  const numericQuantity = Number(quantity);
  const canSubmit = selected.hasUnitMapping && stockQty > 0;

  function stepQuantity(delta: number) {
    const input = quantityRef.current;
    if (!input) return;
    input.stepUp(Math.round(delta / Number(selected.step)));
    onQuantityChange(input.value);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-4 sm:p-5">
      <input type="hidden" name="supplyId" value={selected.id} />
      <input type="hidden" name="stockUnit" value={selected.stockUnit} />
      <div className="border-border bg-muted/30 rounded-2xl border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold wrap-break-word">{selected.name}</h3>
            <p className="text-muted-foreground text-sm">
              {selected.stockQty} {selected.unit} on hand
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 rounded-full"
            disabled={pending}
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>

        <label htmlFor={quantityId} className="mt-4 block text-sm font-semibold">
          Quantity ({selected.unit})
        </label>
        <div className="border-border bg-card mt-1 flex items-center gap-1 rounded-full border p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Decrease quantity"
            className="shrink-0 rounded-full"
            disabled={pending || !canSubmit || numericQuantity - 1 < Number(selected.step)}
            onClick={() => stepQuantity(-1)}
          >
            <Minus />
          </Button>
          <Input
            ref={quantityRef}
            id={quantityId}
            name="quantity"
            type="number"
            inputMode="decimal"
            min={selected.step}
            max={selected.stockQty}
            step={selected.step}
            placeholder="0"
            required
            value={quantity}
            disabled={pending || !canSubmit}
            aria-invalid={Boolean(quantityError)}
            aria-describedby={quantityError ? quantityId + "-error" : undefined}
            onChange={(event) => onQuantityChange(event.target.value)}
            className="min-w-0 rounded-full text-center tabular-nums"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Increase quantity"
            className="shrink-0 rounded-full"
            disabled={pending || !canSubmit || numericQuantity + 1 > stockQty}
            onClick={() => stepQuantity(1)}
          >
            <Plus />
          </Button>
        </div>
        {quantityError ? (
          <p id={quantityId + "-error"} role="alert" className="text-destructive mt-2 text-sm">
            {quantityError}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor={noteId} className="block text-sm font-semibold">
          Note <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          id={noteId}
          name="note"
          className="mt-1"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          disabled={pending || !canSubmit}
        />
      </div>
      <Button type="submit" className="h-11 w-full rounded-full" disabled={pending || !canSubmit}>
        {pending ? "Recording…" : "Take out"}
      </Button>
    </form>
  );
}
