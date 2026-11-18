"use client";

import { useId, useState } from "react";
import { Package, Search } from "lucide-react";
import { displayFont } from "@/components/customer/customer-order-styles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { stockLabels } from "./stock-labels";

const stockColors = {
  OK: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  LOW: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  OUT: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

type StockStatus = keyof typeof stockLabels;
export type CatalogSupply = {
  id: string;
  name: string;
  unit: string;
  stockQty: string;
  status: StockStatus;
  hasUnitMapping: boolean;
};

const stockFilters: ("ALL" | StockStatus)[] = ["ALL", "OK", "LOW", "OUT"];

export default function SupplyCatalog<T extends CatalogSupply>({
  supplies,
  selectedId,
  pending = false,
  onSelect,
  canSelect = () => true,
  actionLabel = "Select",
  mappingMessage = "Ask an admin to configure the stock unit.",
  initialSearch = "",
  initialFilter = "ALL",
}: {
  supplies: T[];
  selectedId: string | null;
  pending?: boolean;
  onSelect?: (supply: T) => void;
  canSelect?: (supply: T) => boolean;
  actionLabel?: string;
  mappingMessage?: string;
  initialSearch?: string;
  initialFilter?: "ALL" | StockStatus;
}) {
  const searchId = useId();
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState<(typeof stockFilters)[number]>(initialFilter);
  const term = search.trim().toLowerCase();
  const visibleSupplies = supplies.filter(
    (supply) =>
      (filter === "ALL" || supply.status === filter) &&
      (supply.name + " " + supply.unit).toLowerCase().includes(term),
  );

  return (
    <section
      aria-labelledby={searchId + "-heading"}
      className="border-border bg-card/88 min-w-0 rounded-3xl border p-4 shadow-[0_22px_65px_rgba(44,28,17,0.12)] sm:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
            Browse supplies
          </p>
          <h2
            id={searchId + "-heading"}
            className="mt-1 text-2xl sm:text-3xl"
            style={{ fontFamily: displayFont }}
          >
            Internal Supplies
          </h2>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor={searchId} className="sr-only">
            Search supplies
          </label>
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            id={searchId}
            type="search"
            className="bg-card h-10 rounded-full pl-9"
            placeholder="Search supplies…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div role="group" aria-label="Filter by stock status" className="mt-4 flex flex-wrap gap-2">
        {stockFilters.map((status) => (
          <Button
            key={status}
            type="button"
            variant={filter === status ? "default" : "outline"}
            className="rounded-full"
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
          >
            {status === "ALL" ? "All supplies" : stockLabels[status]}
          </Button>
        ))}
      </div>

      <p role="status" className="text-muted-foreground mt-4 text-sm">
        {visibleSupplies.length} {visibleSupplies.length === 1 ? "supply" : "supplies"}
      </p>
      {visibleSupplies.length === 0 ? (
        <p className="border-border text-muted-foreground mt-2 rounded-2xl border border-dashed p-6 text-center text-sm">
          {supplies.length
            ? "No supplies match your search or filter."
            : "No internal supplies created yet."}
        </p>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {visibleSupplies.map((supply) => {
            const isSelected = selectedId === supply.id;
            return (
              <Card
                key={supply.id}
                className={cn(
                  "min-w-0 gap-3 rounded-3xl p-4 shadow-[0_18px_45px_rgba(44,28,17,0.11)]",
                  isSelected && "ring-primary ring-2",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="dark:bg-secondary dark:text-secondary-foreground rounded-2xl bg-amber-100 p-2.5 text-amber-900">
                    <Package aria-hidden="true" className="size-5" />
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      stockColors[supply.status],
                    )}
                  >
                    {stockLabels[supply.status]}
                  </span>
                </div>
                <div>
                  <h3
                    className="text-xl leading-tight wrap-break-word"
                    style={{ fontFamily: displayFont }}
                  >
                    {supply.name}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {supply.stockQty} {supply.unit} on hand
                  </p>
                  {!supply.hasUnitMapping ? (
                    <p className="text-muted-foreground mt-1 text-xs">{mappingMessage}</p>
                  ) : null}
                </div>
                {onSelect ? (
                  <Button
                    type="button"
                    variant={isSelected ? "outline" : "default"}
                    className="mt-auto w-full rounded-full"
                    aria-label={actionLabel + " " + supply.name + " (" + supply.unit + ")"}
                    aria-pressed={isSelected}
                    disabled={pending || !canSelect(supply)}
                    onClick={() => onSelect(supply)}
                  >
                    {isSelected ? "Selected" : actionLabel}
                  </Button>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
