import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { getDailyCashDefaultDateKey } from "@/lib/daily-cash/business-date";
import { saveSalaryRateAction } from "./actions";

export default async function DailyCashSettingsPage() {
  await requirePermission(PERMISSIONS.DAILY_CASH_MANAGE);
  const rates = await prisma.dailySalaryRate.findMany({ include: { createdBy: { select: { fullName: true } } }, orderBy: { effectiveBusinessDate: "desc" } });
  return <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6"><PageHeader eyebrow="Daily cash" title="Salary settings" description="Set the combined daily salary. Existing Daily Cash days keep the amount they started with." /><Card><CardHeader><CardTitle>New salary rate</CardTitle><CardDescription>Use the effective business date for the first future daily amount.</CardDescription></CardHeader><CardContent><form action={saveSalaryRateAction} className="grid gap-4 sm:grid-cols-3 sm:items-end"><div className="grid gap-2"><Label>Daily amount</Label><Input name="amount" type="number" min="0" step="0.01" required /></div><div className="grid gap-2"><Label>Effective business date</Label><Input name="effectiveDate" type="date" defaultValue={getDailyCashDefaultDateKey()} required /></div><Button>Save rate</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Rate history</CardTitle></CardHeader><CardContent><div className="space-y-2">{rates.length ? rates.map((rate) => <div key={rate.id} className="flex justify-between rounded-lg border p-3 text-sm"><span>{rate.effectiveBusinessDate.toISOString().slice(0, 10)} · {rate.createdBy.fullName}</span><strong>${Number(rate.amount).toFixed(2)}</strong></div>) : <p className="text-sm text-muted-foreground">No salary rate configured.</p>}</div><Button asChild className="mt-5" variant="outline"><Link href="/admin/daily-cash">Back to Daily cash</Link></Button></CardContent></Card></div>;
}
