"use client";

import { useState } from "react";
import Link from "next/link";
import CashierPaymentDialog from "./CashierPaymentDialog";
import { matchesCashierTable } from "@/lib/cashier/cashier-presentation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type SettlementTable = {
  id: string;
  name: string;
  checks: {
    key: string;
    orderNumber: number;
    total: number;
    rounds: {
      id: string;
      roundNumber: number;
      time: string;
      cashierName: string | null;
      items: { id: string; productName: string; qty: number }[];
    }[];
  }[];
};
const money = (value: number) => `$${value.toFixed(2)}`;

export default function CashierTableBoard({
  tables,
  showEqualSplit,
}: {
  tables: SettlementTable[];
  showEqualSplit: boolean;
}) {
  const [search, setSearch] = useState("");
  const visible = tables.filter((table) =>
    matchesCashierTable(
      {
        name: table.name,
        billNumbers: table.checks.map((check) => check.orderNumber),
      },
      search,
    ),
  );
  return (
    <section aria-label="Open table bills" className="space-y-4">
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-2xl border p-4">
        <label className="min-w-0 flex-1 text-sm font-semibold">
          Find a table or bill
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Table name or bill #273"
            className="mt-2 min-h-11"
          />
        </label>
        {search ? (
          <Button variant="outline" className="min-h-11" onClick={() => setSearch("")}>
            Clear search
          </Button>
        ) : null}
        <p role="status" className="text-muted-foreground w-full text-sm">
          {visible.length} of {tables.length} occupied tables
        </p>
      </div>
      {!visible.length ? (
        <div className="bg-card rounded-2xl border border-dashed p-6">
          <h2 className="text-lg font-semibold">
            {tables.length ? "No matching tables" : "No occupied tables"}
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {tables.length
              ? "Try another table name or bill number."
              : "Unpaid dine-in bills appear here after orders are sent to the kitchen."}
          </p>
        </div>
      ) : null}
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => {
          const total = table.checks.reduce((sum, check) => sum + check.total, 0);
          return (
            <article
              key={table.id}
              hidden={!visible.includes(table)}
              className="bg-card min-w-0 rounded-2xl border p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 text-2xl font-bold break-words">{table.name}</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Occupied
                </span>
              </div>
              <div className="my-4 flex items-end justify-between gap-3">
                <span className="text-muted-foreground text-sm">
                  {table.checks.length} open bill{table.checks.length === 1 ? "" : "s"}
                </span>
                <p className="text-right">
                  <span className="text-muted-foreground block text-xs">Amount due</span>
                  <strong className="text-2xl tabular-nums">{money(total)}</strong>
                </p>
              </div>
              <div className="space-y-2">
                {table.checks.map((check) => (
                  <details key={check.key} className="rounded-xl border">
                    <summary className="focus-visible:outline-ring min-h-11 cursor-pointer rounded-xl p-3 text-sm font-semibold focus-visible:outline-2">
                      Bill #{check.orderNumber} · {check.rounds.length} round
                      {check.rounds.length === 1 ? "" : "s"} · {money(check.total)}
                    </summary>
                    <div className="space-y-2 border-t p-3">
                      {check.rounds.map((round) => (
                        <div key={round.id} className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs font-semibold">
                            Round {round.roundNumber} · {round.time}
                            {round.cashierName ? ` · ${round.cashierName}` : ""}
                          </p>
                          <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                            {round.items.map((item) => (
                              <li key={item.id}>
                                {item.qty} × {item.productName}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
              <div className="mt-4 grid gap-2">
                <Button asChild variant="outline" className="min-h-11">
                  <Link
                    prefetch={false}
                    href={`/cashier/order?tableId=${encodeURIComponent(table.id)}`}
                  >
                    Add order
                  </Link>
                </Button>
                <CashierPaymentDialog
                  tableId={table.id}
                  tableName={table.name}
                  amountDue={total}
                  showEqualSplit={showEqualSplit}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
