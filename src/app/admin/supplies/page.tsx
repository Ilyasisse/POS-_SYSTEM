import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ListPlus } from "lucide-react";
import {
  AdminPage,
  Button,
  Card,
  DataTableCard,
  MetricCard,
  Table,
  TableCell,
  TableHead,
} from "@/components/admin/shared";
import AutoSubmitInput from "@/components/AutoSubmitInput";
import { Label } from "@/components/ui/label";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import { prisma } from "@/lib/prisma";
import {
  calculateSupplyDayTotal,
  calculateSupplyLineTotal,
  getSupplyHistoryStartDateKey,
  getTodaySupplyDateKey,
  resolveSupplyDateKey,
  supplyDateKeyToDatabaseDate,
} from "@/lib/supplies/supply-purchases";
import SupplyEntryForm from "./SupplyEntryForm";
import SupplyRowActions from "./SupplyRowActions";
import { closeSupplyDay, createSupplyPurchase, reopenSupplyDay } from "./actions";

type SupplyPageProps = {
  searchParams?: Promise<{ date?: string; supplyStatus?: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const quantityFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

function displayDate(dateKey: string) {
  const date = supplyDateKeyToDatabaseDate(dateKey);
  return date ? dateFormatter.format(date) : dateKey;
}

function shiftDate(dateKey: string, amount: number) {
  const date = supplyDateKeyToDatabaseDate(dateKey);
  if (!date) return dateKey;
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatQuantity(value: number) {
  return quantityFormatter.format(value);
}

function statusNotice(status: string | undefined) {
  switch (status) {
    case "created":
      return {
        tone: "success",
        message: "Supply purchase added.",
      };
    case "updated":
      return {
        tone: "success",
        message: "Supply purchase updated.",
      };
    case "deleted":
      return {
        tone: "success",
        message: "Supply purchase deleted.",
      };
    case "invalid_date":
      return {
        tone: "error",
        message: "Choose a valid date that is not in the future.",
      };
    case "invalid_entry":
      return {
        tone: "error",
        message: "Enter an item, a positive quantity, and a valid unit price.",
      };
    case "not_found":
      return {
        tone: "error",
        message: "That Supply purchase could not be found.",
      };
    default:
      return null;
  }
}

function SupplyDateControls({
  selectedDate,
  today,
}: {
  selectedDate: string;
  today: string;
}) {
  const previousDate = shiftDate(selectedDate, -1);
  const nextDate = shiftDate(selectedDate, 1);

  return (
    <Card className="p-4">
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="supply-date">Purchase date</Label>
          <AutoSubmitInput
            id="supply-date"
            name="date"
            type="date"
            defaultValue={selectedDate}
            max={today}
          />
        </div>
        <Button asChild type="button" variant="outline">
          <Link href="/admin/supplies">Today</Link>
        </Button>
        <div className="flex gap-2 sm:ml-auto">
          <Button
            asChild
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous day"
          >
            <Link href={`/admin/supplies?date=${previousDate}`}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button
            asChild={selectedDate !== today}
            type="button"
            variant="outline"
            size="icon"
            disabled={selectedDate === today}
            aria-label="Next day"
          >
            {selectedDate === today ? (
              <ChevronRight className="size-4" />
            ) : (
              <Link href={`/admin/supplies?date=${nextDate}`}>
                <ChevronRight className="size-4" />
              </Link>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default async function SuppliesPage({ searchParams }: SupplyPageProps) {
  await requirePermission(PERMISSIONS.SUPPLY_MANAGE);
  const params = (await searchParams) ?? {};
  const today = getTodaySupplyDateKey();
  const selectedDate = resolveSupplyDateKey(params.date);
  const selectedDatabaseDate = supplyDateKeyToDatabaseDate(selectedDate);
  const historyStart = supplyDateKeyToDatabaseDate(
    getSupplyHistoryStartDateKey(today),
  );

  if (!selectedDatabaseDate || !historyStart) return null;

  const [entries, historyEntries, day, catalogRows] = await Promise.all([
    prisma.supplyPurchase.findMany({
      where: { purchaseDate: selectedDatabaseDate },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.supplyPurchase.findMany({
      where: {
        purchaseDate: {
          gte: historyStart,
          lte: supplyDateKeyToDatabaseDate(today)!,
        },
      },
      select: { purchaseDate: true, quantity: true, unitPrice: true },
      orderBy: { purchaseDate: "desc" },
    }),
    prisma.supplyDay.findUnique({ where: { purchaseDate: selectedDatabaseDate }, include: { _count: { select: { payments: true } } } }),
    prisma.supplyCatalogItem.findMany({ orderBy: [{ name: "asc" }, { unit: "asc" }] }),
  ]);
  const catalogItems = catalogRows.map((item) => ({ id: item.id, name: item.name, unit: item.unit, defaultUnitPrice: item.defaultUnitPrice.toString() }));
  const activeCatalogItems = catalogItems.filter((_, index) => catalogRows[index].isActive);
  const closed = Boolean(day?.closedAt);

  const dailyTotal = calculateSupplyDayTotal(entries);
  const totalQuantity = entries.reduce(
    (total, entry) => total + Number(entry.quantity),
    0,
  );
  const history = new Map<
    string,
    { count: number; total: ReturnType<typeof calculateSupplyLineTotal> }
  >();
  for (const entry of historyEntries) {
    const dateKey = entry.purchaseDate.toISOString().slice(0, 10);
    const existing = history.get(dateKey);
    const lineTotal = calculateSupplyLineTotal(entry.quantity, entry.unitPrice);
    if (existing) {
      existing.count += 1;
      existing.total = existing.total.add(lineTotal);
    } else {
      history.set(dateKey, { count: 1, total: lineTotal });
    }
  }
  const notice = statusNotice(params.supplyStatus);

  return (
    <AdminPage
      title="Supply"
      description="Record the items bought each day and review the day’s total spending."
    >
      {notice ? (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={
            notice.tone === "error"
              ? "rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
              : "rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success"
          }
        >
          {notice.message}
        </div>
      ) : null}

      <SupplyDateControls selectedDate={selectedDate} today={today} />

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black">{closed ? "Supply day closed" : "Supply day open"}</p>
          <p className="text-sm text-muted-foreground">{closed ? `Payable from ${displayDate(shiftDate(selectedDate, 1))}.` : "Add every supply received, then close the day."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/admin/supplies/items"><ListPlus className="size-4" />Manage supply items</Link></Button>
          {closed ? <form action={reopenSupplyDay}><input type="hidden" name="date" value={selectedDate} /><Button variant="outline" disabled={(day?._count.payments ?? 0) > 0}>Reopen day</Button></form> : <form action={closeSupplyDay}><input type="hidden" name="date" value={selectedDate} /><Button disabled={entries.length === 0}>Close supply day</Button></form>}
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Daily total"
          value={formatMoney(Number(dailyTotal))}
          helper={displayDate(selectedDate)}
        />
        <MetricCard
          label="Purchase entries"
          value={entries.length}
          helper="Items recorded for this day"
        />
        <MetricCard
          label="Combined quantity"
          value={formatQuantity(totalQuantity)}
          helper="Across all recorded items"
        />
      </section>

      {!closed ? <Card className="p-5">
        <div className="mb-4">
          <h2 className="font-black">Add a Supply purchase</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Unit price and the calculated line price are shown separately.
          </p>
        </div>
        <SupplyEntryForm
          purchaseDate={selectedDate}
          action={createSupplyPurchase}
          catalogItems={activeCatalogItems}
        />
        {activeCatalogItems.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Create an active supply item before adding today&apos;s purchases.</p> : null}
      </Card> : null}

      <DataTableCard
        footer={
          <p className="text-sm font-medium text-muted-foreground">
            {entries.length} item{entries.length === 1 ? "" : "s"} · Total{" "}
            {formatMoney(Number(dailyTotal))}
          </p>
        }
      >
        <Table>
          <thead>
            <tr>
              <TableHead>Item</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Unit price</TableHead>
              <TableHead>Line price</TableHead>
              <TableHead>Recorded by</TableHead>
              <TableHead>Actions</TableHead>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-muted-foreground"
                >
                  No Supply purchases have been recorded for{" "}
                  {displayDate(selectedDate)}.
                </TableCell>
              </tr>
            ) : (
              entries.map((entry) => {
                const lineTotal = calculateSupplyLineTotal(
                  entry.quantity,
                  entry.unitPrice,
                );
                return (
                  <tr key={entry.id} className="border-t align-top">
                    <TableCell className="font-semibold">
                      {entry.itemName}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatQuantity(Number(entry.quantity))}
                    </TableCell>
                    <TableCell>{entry.unit}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatMoney(Number(entry.unitPrice))}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {formatMoney(Number(lineTotal))}
                    </TableCell>
                    <TableCell>{entry.createdBy.fullName}</TableCell>
                    <TableCell>
                      {!closed ?
                      <SupplyRowActions
                        id={entry.id}
                        itemName={entry.itemName}
                        quantity={entry.quantity.toString()}
                        unitPrice={entry.unitPrice.toString()}
                        purchaseDate={selectedDate}
                        maxDate={today}
                        catalogItemId={entry.catalogItemId}
                        catalogItems={catalogItems}
                      />
                      : <span className="text-xs text-muted-foreground">Locked</span>}
                    </TableCell>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </DataTableCard>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5" />
          <div>
            <h2 className="font-black">Recent Supply days</h2>
            <p className="text-sm text-muted-foreground">
              Days with purchases in the last 30 calendar days.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {history.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              No Supply history yet.
            </p>
          ) : (
            [...history.entries()].map(([dateKey, value]) => (
              <Link
                key={dateKey}
                href={`/admin/supplies?date=${dateKey}`}
                className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-3 py-3 transition-colors hover:bg-muted"
              >
                <span>
                  <span className="block text-sm font-semibold">
                    {displayDate(dateKey)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {value.count} item{value.count === 1 ? "" : "s"}
                  </span>
                </span>
                <strong className="tabular-nums">
                  {formatMoney(Number(value.total))}
                </strong>
              </Link>
            ))
          )}
        </div>
      </Card>
    </AdminPage>
  );
}
