import Link from "next/link";
import AutoSubmitInput from "@/components/AutoSubmitInput";
import { ClearFiltersLink } from "@/components/admin/shared";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { getCurrentBusinessDateKey, parseBusinessDateKey } from "@/lib/waiter/waiter-balance-calculations";
import {
  DAILY_CASH_START_DATE,
  getDailyCashDefaultDateKey,
} from "@/lib/daily-cash/business-date";
import { getDailyCash } from "@/lib/daily-cash/service";
import { createManualExpenseAction, deleteManualExpenseAction, finalizeDailyCashAction, overrideSalaryAction, paySalaryAction, paySupplierAdvanceAction, paySupplierObligationAction, paySupplyBalanceAction } from "./actions";
import SavingsAccountCard from "./SavingsAccountCard";
import UndoPaidActivityButton from "./UndoPaidActivityButton";

export const dynamic = "force-dynamic";
const money = (value: number) => `$${value.toFixed(2)}`;
const paidAtTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Nairobi",
});

function Metric({ label, value, help }: { label: string; value: string; help: string }) {
  return <Card size="sm"><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-2xl tabular-nums">{value}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{help}</CardContent></Card>;
}

type DailyCashData = NonNullable<Awaited<ReturnType<typeof getDailyCash>>>;

function TodayCashBreakdown({ data, date }: { data: DailyCashData; date: string }) {
  return <Card>
    <CardHeader>
      <CardTitle>Today&apos;s cash breakdown</CardTitle>
      <CardDescription>Paid activity only, showing where the money went and how each payment was funded.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5 px-0">
      <Table>
        <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Where the money went</TableHead><TableHead>Paid at</TableHead><TableHead className="text-right">From daily cash</TableHead><TableHead className="text-right">From savings</TableHead><TableHead className="text-right">Total</TableHead>{!data.locked ? <TableHead><span className="sr-only">Actions</span></TableHead> : null}</TableRow></TableHeader>
        <TableBody>
          {data.paidBreakdownRows.length ? data.paidBreakdownRows.map((row) => <TableRow key={row.id}>
            <TableCell><Badge variant="outline">{row.type}</Badge></TableCell>
            <TableCell className="font-medium">{row.description}</TableCell>
            <TableCell>{paidAtTime.format(row.paidAt)}</TableCell>
            <TableCell className="text-right tabular-nums">{money(row.revenueFunded)}</TableCell>
            <TableCell className="text-right tabular-nums">{money(row.savingsFunded)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{money(row.amount)}</TableCell>
            {!data.locked ? <TableCell className="text-right"><UndoPaidActivityButton date={date} row={row} /></TableCell> : null}
          </TableRow>) : <TableRow><TableCell colSpan={data.locked ? 6 : 7} className="py-8 text-center text-muted-foreground">No paid expenses have been recorded for this business day.</TableCell></TableRow>}
        </TableBody>
      </Table>
      <div className="ml-auto grid max-w-md gap-2 px-6 text-sm">
        <div className="flex items-center justify-between gap-6"><span className="text-muted-foreground">End-day cash</span><span className="font-medium tabular-nums">+{money(data.endDayCash)}</span></div>
        <div className="flex items-center justify-between gap-6"><span className="text-muted-foreground">Savings used</span><span className="font-medium tabular-nums">+{money(data.paidBreakdownTotals.savingsUsed)}</span></div>
        <div className="flex items-center justify-between gap-6"><span className="text-muted-foreground">Total paid</span><span className="font-medium tabular-nums">-{money(data.paidBreakdownTotals.totalPaid)}</span></div>
        <div className="flex items-center justify-between gap-6 border-t pt-2 text-base"><span className="font-semibold">Current remaining</span><span className="font-bold tabular-nums">{money(data.summary.cashAvailableNow)}</span></div>
      </div>
    </CardContent>
  </Card>;
}

export default async function DailyCashPage({ searchParams }: { searchParams?: Promise<{ date?: string }> }) {
  await requirePermission(PERMISSIONS.DAILY_CASH_MANAGE);
  const params = await searchParams;
  const now = new Date();
  const currentDate = getCurrentBusinessDateKey(now);
  const requested = parseBusinessDateKey(params?.date ?? "");
  const date = requested && requested >= DAILY_CASH_START_DATE && requested <= currentDate
    ? requested
    : getDailyCashDefaultDateKey(now);
  const data = await getDailyCash(date, now);

  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
    <PageHeader eyebrow="Operations" title="Daily cash" description="Use waiter end-day cash to pay salary, prior-day supplies, supplier obligations, and one-time expenses." />
    <Card><CardContent className="pt-6"><form method="get" className="flex flex-wrap items-end gap-3"><div className="grid gap-2"><Label htmlFor="daily-cash-date">Business day</Label><AutoSubmitInput id="daily-cash-date" name="date" type="date" defaultValue={date} min={DAILY_CASH_START_DATE} max={currentDate} /></div><ClearFiltersLink href="/admin/daily-cash" show={Boolean(params?.date)} /><Button asChild variant="outline"><Link href="/admin/daily-cash/settings">Salary settings</Link></Button></form></CardContent></Card>
    {!data ? <Alert><AlertCircle /><AlertTitle>Salary setup required</AlertTitle><AlertDescription>Set the combined daily salary before Daily Cash can create records or payments.</AlertDescription></Alert> : <DailyCashContent data={data} date={date} />}
  </div>;
}

function SupplyPayments({ data, date }: { data: DailyCashData; date: string }) {
  return <Card><CardHeader><CardTitle>Supply payments</CardTitle><CardDescription>Closed supply days become due the next day. Pay any amount and carry the remainder forward.</CardDescription></CardHeader><CardContent className="px-0"><Table><TableHeader><TableRow><TableHead>Received</TableHead><TableHead>Due</TableHead><TableHead>Original</TableHead><TableHead>Paid</TableHead><TableHead>Remaining</TableHead><TableHead>Payment</TableHead></TableRow></TableHeader><TableBody>{data.supplyObligations.length ? data.supplyObligations.map((row) => {
    const received = row.purchaseDate.toISOString().slice(0, 10);
    const due = row.dueDate.toISOString().slice(0, 10);
    const inputId = `supply-payment-${row.supplyDayId}`;
    return <TableRow key={row.supplyDayId}><TableCell>{received}</TableCell><TableCell>{due}{due < date ? <Badge variant="destructive" className="ml-2">Overdue</Badge> : <Badge variant="secondary" className="ml-2">Due</Badge>}</TableCell><TableCell>{money(row.originalTotal)}</TableCell><TableCell>{money(row.paidAmount)}</TableCell><TableCell className="font-semibold">{money(row.amount)}</TableCell><TableCell>{!data.locked ? <form action={paySupplyBalanceAction} className="flex items-center justify-end gap-2"><Input type="hidden" name="date" value={date} /><Input type="hidden" name="supplyDayId" value={row.supplyDayId} /><Label htmlFor={inputId} className="sr-only">Payment for supplies received {received}</Label><Input id={inputId} name="amount" type="number" min="0.01" max={row.amount.toFixed(2)} step="0.01" defaultValue={row.amount.toFixed(2)} required className="w-28" /><label className="flex items-center gap-1 text-xs"><Input type="checkbox" name="confirmSavings" className="size-4" />Savings</label><Button size="sm">Pay</Button></form> : <span className="text-sm text-muted-foreground">Read only</span>}</TableCell></TableRow>;
  }) : <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No supply balances are due.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>;
}

function DailyCashContent({ data, date }: { data: DailyCashData; date: string }) {
  const locked = data.locked;
  const statusTone = data.status === "LOCKED" ? "destructive" : data.status === "FINALIZED" ? "default" : "secondary";
  const paidExpenses = data.paidRevenueFunded + data.paidSavingsFunded;
  return <>
    <div className="flex items-center justify-between gap-3"><Badge variant={statusTone}>{data.status.replace("_", " ")}</Badge><span className="text-sm text-muted-foreground">{date} · POS business day</span></div>
    {data.missingWaiters.length ? <Alert><AlertCircle /><AlertTitle>Waiter revenue for {data.waiterBalanceDateKey} is incomplete</AlertTitle><AlertDescription>Missing waiter end-day amounts for {data.waiterBalanceDateKey}: {data.missingWaiters.map((row) => row.fullName).join(", ")}. You may still record payments.</AlertDescription></Alert> : null}
    {locked ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Day locked</AlertTitle><AlertDescription>This business day is 14 days old or older and cannot be changed.</AlertDescription></Alert> : null}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Metric label="Waiter revenue" value={money(data.endDayCash)} help={`Combined from Waiter Balances for ${data.waiterBalanceDateKey}`} />
      <Metric label="Paid expenses" value={money(paidExpenses)} help="Salary, supplies, manual, and supplier payments" />
      <Metric label="Unpaid required" value={money(data.unpaidRequired)} help="Salary, supplies, and eligible invoices" />
      <Metric label="Projected remaining" value={money(data.summary.projectedRemaining)} help="After all shown required expenses" />
      <Metric label="Savings used" value={money(data.summary.savingsUsed)} help="Confirmed funding already used" />
      <Metric label="Additional savings required" value={money(data.summary.additionalSavingsRequired)} help="To pay all current obligations" />
    </section>
    <SavingsAccountCard data={data} date={date} />
    <SupplyPayments data={data} date={date} />
    <Card><CardHeader><CardTitle>Combined daily salary</CardTitle><CardDescription>Must be paid in full. Override applies only to this business day.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-end gap-4"><div><p className="text-2xl font-bold tabular-nums">{money(Number(data.day.salaryAmount))}</p><p className="text-xs text-muted-foreground">{data.salaryPaid ? "Paid" : "Unpaid"}{data.day.salaryOverridden ? " · Day override" : " · Default rate"}</p></div>{!locked && !data.salaryPaid ? <><form action={paySalaryAction} className="flex items-end gap-2"><Input type="hidden" name="date" value={date} /><label className="flex items-center gap-2 text-xs"><Input type="checkbox" name="confirmSavings" className="size-4" />Use savings if needed</label><Button>Pay salary</Button></form><form action={overrideSalaryAction} className="flex items-end gap-2"><Input type="hidden" name="date" value={date} /><div className="grid gap-1"><Label className="text-xs">One-day amount</Label><Input name="amount" type="number" min="0" step="0.01" defaultValue={Number(data.day.salaryAmount).toFixed(2)} className="w-32" /></div><Button type="submit" variant="outline">Override</Button></form></> : null}</CardContent></Card>
    <Card><CardHeader><CardTitle>Supplier obligations and advances</CardTitle><CardDescription>Pay before the due date, pay more than one invoice, or record an advance. Extra money clears this supplier&apos;s other open invoices before becoming future credit.</CardDescription></CardHeader><CardContent className="space-y-5 px-0">{!locked ? <form action={paySupplierAdvanceAction} className="mx-6 grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-[1fr_9rem_auto_auto] md:items-end"><Input type="hidden" name="date" value={date} /><div className="grid gap-1"><Label htmlFor="advance-supplier">Supplier advance</Label><select id="advance-supplier" name="supplierId" required className="h-9 rounded-md border bg-background px-3 text-sm"><option value="">Choose supplier</option>{data.supplierAccounts.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.credit > 0 ? ` · ${money(supplier.credit)} credit` : ""}</option>)}</select></div><div className="grid gap-1"><Label htmlFor="advance-amount">Amount</Label><Input id="advance-amount" name="amount" type="number" min="0.01" step="0.01" required /></div><label className="flex items-center gap-1 text-xs"><Input type="checkbox" name="confirmSavings" className="size-4" />Use savings</label><Button type="submit">Pay supplier</Button></form> : null}<Table><TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Invoice</TableHead><TableHead>Due</TableHead><TableHead>Remaining balance</TableHead><TableHead>Payment amount</TableHead></TableRow></TableHeader><TableBody>{data.obligations.length ? data.obligations.map((row) => { const dueDateKey = row.dueDate.toISOString().slice(0, 10); const paymentInputId = `supplier-payment-${row.installmentId ?? row.billId}`; return <TableRow key={`${row.billId}-${row.installmentId ?? "bill"}`}><TableCell>{row.supplierName}</TableCell><TableCell>{row.invoiceNumber ?? "No invoice #"}</TableCell><TableCell>{dueDateKey} {dueDateKey < date ? <Badge variant="destructive" className="ml-2">Overdue</Badge> : dueDateKey === date ? <Badge variant="secondary" className="ml-2">Due</Badge> : <Badge variant="outline" className="ml-2">Upcoming</Badge>}</TableCell><TableCell className="font-semibold">{money(row.amount)}</TableCell><TableCell>{!locked ? <form action={paySupplierObligationAction} className="flex flex-wrap items-center justify-end gap-2"><Input type="hidden" name="date" value={date} /><Input type="hidden" name="billId" value={row.billId} />{row.installmentId ? <Input type="hidden" name="installmentId" value={row.installmentId} /> : null}<Label htmlFor={paymentInputId} className="sr-only">Payment amount for {row.supplierName}</Label><Input id={paymentInputId} name="amount" type="number" min="0.01" step="0.01" defaultValue={row.amount.toFixed(2)} required className="w-28" /><label className="flex items-center gap-1 text-xs" title="Required when paying more than this balance"><Input type="checkbox" name="allowOverpayment" className="size-4" />Extra / credit</label><label className="flex items-center gap-1 text-xs"><Input type="checkbox" name="confirmSavings" className="size-4" />Savings</label><Button size="sm">Pay</Button></form> : <span className="text-sm text-muted-foreground">Read only</span>}</TableCell></TableRow>; }) : <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No pending supplier obligations.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
    <Card><CardHeader><CardTitle>One-time expenses</CardTitle><CardDescription>Expenses are paid immediately when added.</CardDescription></CardHeader><CardContent className="space-y-5">{!locked ? <form action={createManualExpenseAction} className="grid gap-3 md:grid-cols-[1fr_10rem_1fr_auto_auto] md:items-end"><Input type="hidden" name="date" value={date} /><div className="grid gap-1"><Label>Name</Label><Input name="description" required maxLength={160} /></div><div className="grid gap-1"><Label>Amount</Label><Input name="amount" type="number" min="0.01" step="0.01" required /></div><div className="grid gap-1"><Label>Note</Label><Input name="note" maxLength={500} /></div><label className="flex items-center gap-2 text-xs"><Input type="checkbox" name="confirmSavings" className="size-4" />Use savings</label><Button>Add expense</Button></form> : null}<Table><TableHeader><TableRow><TableHead>Expense</TableHead><TableHead>Note</TableHead><TableHead>Amount</TableHead><TableHead>Funding</TableHead><TableHead /></TableRow></TableHeader><TableBody>{data.day.manualExpenses.length ? data.day.manualExpenses.map((row) => <TableRow key={row.id}><TableCell>{row.description}</TableCell><TableCell>{row.note || "—"}</TableCell><TableCell>{money(Number(row.amount))}</TableCell><TableCell className="text-xs">Daily cash {money(Number(row.revenueFunded))} · Savings {money(Number(row.savingsFunded))}</TableCell><TableCell>{!locked ? <form action={deleteManualExpenseAction}><Input type="hidden" name="date" value={date} /><Input type="hidden" name="id" value={row.id} /><Button type="submit" size="sm" variant="outline">Remove</Button></form> : null}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No one-time expenses recorded.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
    <TodayCashBreakdown data={data} date={date} />
    {!locked ? <form action={finalizeDailyCashAction} className="flex justify-end"><Input type="hidden" name="date" value={date} /><Button variant="outline">{data.status === "FINALIZED" ? "Re-close day" : "Close day"}</Button></form> : null}
  </>;
}
