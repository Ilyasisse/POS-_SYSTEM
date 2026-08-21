import { AlertCircle, CalendarDays, CircleDollarSign, Users } from "lucide-react";
import { ClearFiltersLink } from "@/components/admin/shared";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  getWaiterBalanceAdminRows,
  getWaiterInitializationRowsWithInactive,
  type WaiterBalanceAdminRow,
} from "@/lib/waiter/waiter-balance-admin";
import {
  getBusinessDayRangeForKey,
  getDefaultWaiterBalanceDateKey,
  isLedgerActive,
  parseBusinessDateKey,
  WAITER_BALANCE_LEDGER_START_DATE,
} from "@/lib/waiter/waiter-balance-ledger";
import { InitializationDialog } from "./InitializationDialog";
import { SettlementSubmitButton } from "./SettlementSubmitButton";
import { WaiterBalanceDateFilter } from "./WaiterBalanceDateFilter";
import { saveWaiterDailySettlement } from "./actions";

export const dynamic = "force-dynamic";

type WaiterBalancesPageProps = {
  searchParams?: Promise<{
    date?: string;
    status?: string;
    showInactive?: string;
  }>;
};

const businessDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function formatMoney(value: number | null) {
  if (value == null) return "--";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatBusinessDay(date: string) {
  const { start, end } = getBusinessDayRangeForKey(date);
  return `${businessDateFormatter.format(start)}, 7:00 AM to ${businessDateFormatter.format(end)}, 5:00 AM`;
}

function getStatusNotice(status?: string) {
  switch (status) {
    case "initialized":
      return { title: "Opening balance locked", description: "The waiter's one-time opening balance is now active.", destructive: false };
    case "settlement_saved":
      return { title: "Settlement saved", description: "The end-day values and carried balance were updated.", destructive: false };
    case "already_initialized":
      return { title: "Balance already locked", description: "This waiter's one-time opening balance cannot be changed.", destructive: true };
    case "invalid_initial_balance":
      return { title: "Invalid opening balance", description: "Enter zero or a negative amount.", destructive: true };
    case "invalid_settlement":
      return { title: "Invalid settlement", description: "Sales and end-day amount must be nonnegative numbers.", destructive: true };
    case "initialization_required":
      return { title: "Opening balance required", description: "Lock this waiter's one-time opening balance before closing a day.", destructive: true };
    case "future_date":
      return { title: "Future date blocked", description: "Only completed or current POS business days can be edited.", destructive: true };
    case "before_activation":
      return { title: "Date unavailable", description: "The waiter ledger begins on July 1, 2026.", destructive: true };
    case "waiter_not_found":
      return { title: "Waiter not found", description: "The selected staff record is no longer a waiter.", destructive: true };
    case "save_failed":
      return { title: "Could not save", description: "No balance changes were applied. Please try again.", destructive: true };
    case "inactive_waiter":
      return {
        title: "Inactive waiter blocked",
        description: "Inactive waiters can only correct a closed historical settlement.",
        destructive: true,
      };
    default:
      return null;
  }
}

function statusBadge(row: WaiterBalanceAdminRow) {
  if (row.status === "uninitialized") {
    return <Badge variant="destructive">Needs opening</Badge>;
  }
  if (row.status === "closed") {
    return <Badge className="bg-emerald-600 text-white">Closed</Badge>;
  }
  if (row.status === "open") return <Badge variant="secondary">Open</Badge>;
  return <Badge variant="outline">Not recorded</Badge>;
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{helper}</CardContent>
    </Card>
  );
}

function BalanceTable({
  rows,
  businessDate,
  showInactive,
}: {
  rows: WaiterBalanceAdminRow[];
  businessDate: string;
  showInactive: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No waiters found"
        description="Add waiter staff accounts before recording end-day balances."
      />
    );
  }

  return (
    <Table className="min-w-[1100px]">
      <TableHeader>
        <TableRow>
          <TableHead>Waiter</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Opening</TableHead>
          <TableHead>Manual sales</TableHead>
          <TableHead>POS reference</TableHead>
          <TableHead>End-day amount</TableHead>
          <TableHead>Daily difference</TableHead>
          <TableHead>Resulting balance</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const formId = `settlement-${businessDate}-${row.waiterId}`;
          const hasExistingSettlement = row.shiftId != null;
          const canEditSettlement = row.canEditSettlement;
          const canInitialize = row.canInitialize;
          const isEditable = canEditSettlement;

          return (
            <TableRow key={`${businessDate}-${row.waiterId}`}>
              <TableCell>
                <div className="min-w-44">
                  <div className="flex items-center gap-2 font-medium">
                    {row.fullName}
                    {!row.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{row.email}</p>
                  {row.settledByName ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last saved by {row.settledByName}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{statusBadge(row)}</TableCell>
              <TableCell className={row.openingBalance && row.openingBalance < 0 ? "font-semibold text-destructive" : ""}>
                {formatMoney(row.openingBalance)}
              </TableCell>
              <TableCell>
                <Label className="sr-only" htmlFor={`sales-${businessDate}-${row.waiterId}`}>
                  Manual sales for {row.fullName}
                </Label>
                <Input
                  id={`sales-${businessDate}-${row.waiterId}`}
                  form={formId}
                  name="reportedSales"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  required
                  disabled={!isEditable}
                  defaultValue={(row.reportedSales ?? row.posSales).toFixed(2)}
                  className="w-32"
                />
              </TableCell>
              <TableCell className="font-medium">{formatMoney(row.posSales)}</TableCell>
              <TableCell>
                <Label className="sr-only" htmlFor={`end-day-${businessDate}-${row.waiterId}`}>
                  End-day amount for {row.fullName}
                </Label>
                <Input
                  id={`end-day-${businessDate}-${row.waiterId}`}
                  form={formId}
                  name="endDayAmount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  required
                  disabled={!isEditable}
                  defaultValue={row.endDayAmount?.toFixed(2) ?? ""}
                  placeholder="0.00"
                  className="w-32"
                />
              </TableCell>
              <TableCell className={row.dailyDifference != null && row.dailyDifference < 0 ? "font-semibold text-destructive" : ""}>
                {formatMoney(row.dailyDifference)}
              </TableCell>
              <TableCell className={row.endingBalance != null && row.endingBalance < 0 ? "font-semibold text-destructive" : "font-semibold"}>
                {formatMoney(row.endingBalance)}
              </TableCell>
              <TableCell className="text-right">
                {canEditSettlement ? (
                  <form id={formId} action={saveWaiterDailySettlement}>
                    <input type="hidden" name="waiterId" value={row.waiterId} />
                    <input type="hidden" name="businessDate" value={businessDate} />
                    {showInactive ? (
                      <input type="hidden" name="showInactive" value="1" />
                    ) : null}
                    <SettlementSubmitButton hasExistingSettlement={hasExistingSettlement} />
                  </form>
                ) : canInitialize ? (
                  <InitializationDialog
                    waiterId={row.waiterId}
                    waiterName={row.fullName}
                    businessDate={businessDate}
                    showInactive={showInactive}
                  />
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="whitespace-nowrap">
                      Inactive
                    </Badge>
                    {showInactive ? (
                      <p className="max-w-44 text-xs text-muted-foreground">
                        Historical corrections are only allowed when a closed settlement already exists.
                      </p>
                    ) : null}
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default async function WaiterBalancesPage({
  searchParams,
}: WaiterBalancesPageProps) {
  await requirePermission(PERMISSIONS.WAITER_BALANCE_ADMIN);
  const params = await searchParams;
  const now = new Date();
  const defaultBusinessDate = getDefaultWaiterBalanceDateKey(now);
  const ledgerActive = isLedgerActive(now);
  const requestedDate = parseBusinessDateKey(params?.date ?? "");
  const showInactive = params?.showInactive === "1";
  const selectedDateIsValid =
    requestedDate != null &&
    requestedDate >= WAITER_BALANCE_LEDGER_START_DATE &&
    requestedDate <= defaultBusinessDate;
  const selectedBusinessDate = selectedDateIsValid
    ? requestedDate
    : defaultBusinessDate;
  const notice = getStatusNotice(params?.status);

  if (!ledgerActive) {
    const waiters = await getWaiterInitializationRowsWithInactive(showInactive);

    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
        <PageHeader
          eyebrow="Operations"
          title="Waiter balances"
          description="Track end-day sales, money handed in, and shortages that carry forward."
        />
        <Alert>
          <CalendarDays aria-hidden="true" />
          <AlertTitle>Ledger activates July 1, 2026 at 7:00 AM</AlertTitle>
          <AlertDescription>
            Existing shifts remain unchanged. At activation, each waiter receives one immutable opening balance.
          </AlertDescription>
        </Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Waiters ready for setup"
            value={waiters.length}
            helper={
              showInactive
                ? "Active and inactive waiter accounts"
                : "Active waiters only; enable Show inactive to include the rest."
            }
          />
          <MetricCard label="Starting business day" value="Jul 1" helper="POS window: 7:00 AM to 5:00 AM" />
        </div>
      </div>
    );
  }

  const rows = await getWaiterBalanceAdminRows(selectedBusinessDate, {
    includeInactive: showInactive,
    now,
  });
  const initializedCount = rows.filter((row) => row.initialization).length;
  const recordedCount = rows.filter((row) => row.status === "closed").length;
  const posSalesTotal = rows.reduce((total, row) => total + row.posSales, 0);
  const outstandingBalance = rows.reduce(
    (total, row) => total + (row.endingBalance ?? row.openingBalance ?? 0),
    0,
  );
  const invalidDateRequested = params?.date && !selectedDateIsValid;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <PageHeader
        eyebrow="Operations"
        title="Waiter balances"
        description="Enter manual sales and end-day money; shortages carry into the waiter's next recorded day."
      />

      {notice ? (
        <Alert variant={notice.destructive ? "destructive" : "default"}>
          <AlertCircle aria-hidden="true" />
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.description}</AlertDescription>
        </Alert>
      ) : null}

      {invalidDateRequested ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Date unavailable</AlertTitle>
          <AlertDescription>
            Showing the most recently completed business day instead. The active POS business day becomes available after it closes at 5:00 AM.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Business day</CardTitle>
          <CardDescription>
            {formatBusinessDay(selectedBusinessDate)} This page defaults to the most recently completed POS business day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <WaiterBalanceDateFilter
              latestCompletedBusinessDate={defaultBusinessDate}
              ledgerStartDate={WAITER_BALANCE_LEDGER_START_DATE}
              selectedBusinessDate={selectedBusinessDate}
              showInactive={showInactive}
            />
            <ClearFiltersLink
              href="/admin/waiter-balances"
              show={Boolean(params?.date || showInactive)}
            />
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Initialized waiters" value={`${initializedCount}/${rows.length}`} helper="One-time opening balances locked" />
        <MetricCard label="Closed records" value={`${recordedCount}/${rows.length}`} helper="Selected business day" />
        <MetricCard label="POS reference sales" value={formatMoney(posSalesTotal)} helper="Reference only; manual sales drives debt" />
        <MetricCard label="Outstanding balance" value={formatMoney(outstandingBalance)} helper="Negative shortages still owed" />
      </div>

      {initializedCount < rows.length ? (
        <Alert>
          <CircleDollarSign aria-hidden="true" />
          <AlertTitle>{rows.length - initializedCount} waiter(s) need an opening balance</AlertTitle>
          <AlertDescription>
            Lock zero or a negative starting amount once. It cannot be edited afterward.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>End-day settlements</CardTitle>
          <CardDescription>
            Manual sales controls the balance calculation. POS sales is displayed only to help detect entry mistakes.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <BalanceTable
            key={selectedBusinessDate}
            rows={rows}
            businessDate={selectedBusinessDate}
            showInactive={showInactive}
          />
        </CardContent>
      </Card>
    </div>
  );
}
