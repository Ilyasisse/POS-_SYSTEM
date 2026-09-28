import {
  AdminPage,
  Button,
  Card,
  DataTableCard,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  employmentReviewFilter,
  employmentReviewFilters,
  employmentReviewWindow,
} from "@/lib/staff/employment-expiry";
import Link from "next/link";
import { saveEmploymentAction } from "../actions";

const label = "grid gap-1 text-sm font-semibold text-slate-700";

type Props = { searchParams?: Promise<{ review?: string }> };

export default async function EmploymentPage({ searchParams }: Props) {
  await requirePermission(PERMISSIONS.EMPLOYMENT_MANAGE);
  const review = employmentReviewFilter((await searchParams)?.review);
  const { today, afterThirtyDays } = employmentReviewWindow(new Date());
  const expiringWhere = {
    status: "ACTIVE" as const,
    effectiveTo: { gte: today, lt: afterThirtyDays },
  };
  const expiredWhere = {
    status: "ACTIVE" as const,
    effectiveTo: { lt: today },
  };
  const [staff, profiles, expiringCount, expiredCount] = await Promise.all([
    prisma.staff.findMany({
      where: { role: { not: "SUPPLIER" }, isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, role: true },
    }),
    prisma.employmentProfile.findMany({
      where:
        review === "expiring"
          ? expiringWhere
          : review === "expired"
            ? expiredWhere
            : undefined,
      include: { user: { select: { fullName: true, role: true } } },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.employmentProfile.count({ where: expiringWhere }),
    prisma.employmentProfile.count({ where: expiredWhere }),
  ]);
  return (
    <AdminPage
      title="Employment profiles"
      description="Admin-only compensation terms and effective dates."
    >
      <Card className="p-5">
        <form
          action={saveEmploymentAction}
          className="grid gap-4 md:grid-cols-3"
        >
          <label className={label}>
            Worker
            <select
              name="userId"
              required
              className="h-9 rounded-lg border px-3"
            >
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName} · {member.role}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Compensation type
            <select
              name="compensationType"
              className="h-9 rounded-lg border px-3"
            >
              <option value="DAILY">Daily rate</option>
              <option value="MONTHLY">Monthly salary</option>
            </select>
          </label>
          <label className={label}>
            Status
            <select name="status" className="h-9 rounded-lg border px-3">
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="ENDED">Ended</option>
            </select>
          </label>
          <label className={label}>
            Daily rate (USD)
            <Input name="dailyRate" type="number" min="0.01" step="0.01" />
          </label>
          <label className={label}>
            Monthly salary (USD)
            <Input name="monthlySalary" type="number" min="0.01" step="0.01" />
          </label>
          <label className={label}>
            Effective from
            <Input name="effectiveFrom" type="date" required />
          </label>
          <label className={label}>
            Effective to (optional)
            <Input name="effectiveTo" type="date" />
          </label>
          <div className="md:col-span-2 flex items-end">
            <Button type="submit">Save employment profile</Button>
          </div>
        </form>
      </Card>
      <nav className="flex flex-wrap gap-2" aria-label="Employment term review">
        {employmentReviewFilters.map((filter) => (
          <Link
            key={filter}
            href={
              filter === "all"
                ? "/admin/staff/employment"
                : `/admin/staff/employment?review=${filter}`
            }
            aria-current={review === filter ? "page" : undefined}
            className={`rounded-lg border px-3 py-2 text-sm ${review === filter ? "border-blue-600 bg-blue-50 font-semibold" : "border-slate-200"}`}
          >
            {filter === "all"
              ? "All profiles"
              : filter === "expiring"
                ? `Expiring within 30 days (${expiringCount})`
                : `Expired (${expiredCount})`}
          </Link>
        ))}
      </nav>
      <DataTableCard>
        <Table>
          <thead>
            <tr>
              <TableHead>Worker</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Status</TableHead>
            </tr>
          </thead>
          <tbody>
            {profiles.length ? (
              profiles.map((profile) => (
                <tr key={profile.id}>
                  <TableCell className="font-semibold">
                    {profile.user.fullName}
                    <div className="text-xs text-slate-500">
                      {profile.user.role}
                    </div>
                  </TableCell>
                  <TableCell>
                    {profile.compensationType === "DAILY"
                      ? `$${profile.dailyRate?.toFixed(2)} / day`
                      : `$${profile.monthlySalary?.toFixed(2)} / month`}
                  </TableCell>
                  <TableCell>
                    {profile.effectiveFrom.toLocaleDateString()} –{" "}
                    {profile.effectiveTo?.toLocaleDateString() ?? "ongoing"}
                    {profile.status === "ACTIVE" &&
                    profile.effectiveTo &&
                    profile.effectiveTo < today ? (
                      <div className="text-xs font-semibold text-red-700">
                        Term expired; update the profile
                      </div>
                    ) : profile.status === "ACTIVE" &&
                      profile.effectiveTo &&
                      profile.effectiveTo >= today &&
                      profile.effectiveTo < afterThirtyDays ? (
                      <div className="text-xs font-semibold text-amber-700">
                        Term expires within 30 days
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <ToneBadge
                      tone={profile.status === "ACTIVE" ? "green" : "slate"}
                    >
                      {profile.status}
                    </ToneBadge>
                  </TableCell>
                </tr>
              ))
            ) : (
              <tr>
                <TableCell colSpan={4} className="py-10 text-center">
                  {review === "all"
                    ? "No employment profiles configured."
                    : "No profiles match this review."}
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
