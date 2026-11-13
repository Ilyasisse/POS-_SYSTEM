"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { displayFont } from "@/components/customer/customer-order-styles";
import SupplyCatalog from "@/components/inventory/SupplyCatalog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { InventoryStatus, InventorySupplyRow } from "@/types/admin/Inventory.types";
import type { adjustSupplyInventory, updateSupplyInventory } from "../actions";
import InventorySupplyDetails from "./InventorySupplyDetails";

const desktopQuery = "(min-width: 1024px)";
const headerClass =
  "bg-[linear-gradient(145deg,#20140f_0%,#4a281a_42%,#8c5b34_100%)] p-5 text-white dark:bg-none dark:bg-secondary";
const title = "Manage stock";
const description = "Review the selected supply, set stock, or record a restock.";

function subscribeToDesktop(callback: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export default function InventorySupplyWorkspace({
  supplies,
  initialSearch,
  initialFilter,
  updateStock,
  restock,
}: {
  supplies: InventorySupplyRow[];
  initialSearch: string;
  initialFilter: "ALL" | InventoryStatus;
  updateStock: typeof updateSupplyInventory;
  restock: typeof adjustSupplyInventory;
}) {
  const isDesktop = useSyncExternalStore(
    subscribeToDesktop,
    () => window.matchMedia(desktopQuery).matches,
    () => true,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const selected = supplies.find((supply) => supply.id === selectedId);

  function clearSelection() {
    setSelectedId(null);
    setSheetOpen(false);
  }

  const details = selected ? (
    <InventorySupplyDetails
      key={selected.id + selected.stockUnit}
      supply={selected}
      pending={pending}
      onPendingChange={setPending}
      onClear={clearSelection}
      updateStock={updateStock}
      restock={restock}
    />
  ) : (
    <p className="border-border text-muted-foreground m-5 rounded-2xl border border-dashed p-6 text-center text-sm">
      Select a supply to review its stock.
    </p>
  );

  return (
    <div className="grid items-start gap-4 pb-14 lg:grid-cols-[minmax(0,1fr)_23rem] lg:pb-0 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <SupplyCatalog
        supplies={supplies}
        selectedId={selected?.id ?? null}
        pending={pending}
        initialSearch={initialSearch}
        initialFilter={initialFilter}
        actionLabel="Manage"
        mappingMessage="Configure the stock unit before changing stock."
        onSelect={(supply) => {
          setSelectedId(supply.id);
          if (!isDesktop) setSheetOpen(true);
        }}
      />

      {isDesktop ? (
        <aside
          aria-label={title}
          className="border-border bg-card hidden max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-3xl border shadow-[0_22px_65px_rgba(44,28,17,0.14)] lg:sticky lg:top-20 lg:block"
        >
          <div className={headerClass}>
            <h2 className="text-3xl" style={{ fontFamily: displayFont }}>
              {title}
            </h2>
            <p className="mt-1 text-sm text-white/80">{description}</p>
          </div>
          {details}
        </aside>
      ) : (
        <Sheet
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!pending || open) setSheetOpen(open);
          }}
        >
          <div className="pointer-events-none fixed inset-x-3 bottom-4 z-30 flex justify-end lg:hidden">
            <Button
              ref={reviewButton}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className="pointer-events-auto h-11 max-w-full rounded-full px-5 shadow-lg"
              onClick={() => setSheetOpen(true)}
            >
              Review supply ({selected ? 1 : 0})
            </Button>
          </div>
          <SheetContent
            className="bg-card gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md [&>[data-slot=sheet-close]]:text-white"
            showCloseButton={!pending}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              reviewButton.current?.focus();
            }}
          >
            <SheetHeader className={headerClass + " pr-12"}>
              <SheetTitle className="text-3xl text-white" style={{ fontFamily: displayFont }}>
                {title}
              </SheetTitle>
              <SheetDescription className="text-white/80">{description}</SheetDescription>
            </SheetHeader>
            {details}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
