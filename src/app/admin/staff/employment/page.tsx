import { AdminPage, Button, Card, DataTableCard, Table, TableCell, TableHead, ToneBadge } from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { saveEmploymentAction } from "../actions";

const label = "grid gap-1 text-sm font-semibold text-slate-700";

export default async function EmploymentPage() {
  await requirePermission(PERMISSIONS.EMPLOYMENT_MANAGE);
  const [staff, profiles] = await Promise.all([
    prisma.user.findMany({ where: { role: { notIn: ["CUSTOMER", "SUPPLIER"] }, isActive: true }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, role: true } }),
    prisma.employmentProfile.findMany({ include: { user: { select: { fullName: true, role: true } } }, orderBy: { user: { fullName: "asc" } } }),
  ]);
  return <AdminPage title="Employment profiles" description="Admin-only compensation terms and effective dates.">
    <Card className="p-5"><form action={saveEmploymentAction} className="grid gap-4 md:grid-cols-3">
      <label className={label}>Worker<select name="userId" required className="h-9 rounded-lg border px-3">{staff.map((member) => <option key={member.id} value={member.id}>{member.fullName} · {member.role}</option>)}</select></label>
      <label className={label}>Compensation type<select name="compensationType" className="h-9 rounded-lg border px-3"><option value="DAILY">Daily rate</option><option value="MONTHLY">Monthly salary</option></select></label>
      <label className={label}>Status<select name="status" className="h-9 rounded-lg border px-3"><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="ENDED">Ended</option></select></label>
      <label className={label}>Daily rate (USD)<Input name="dailyRate" type="number" min="0.01" step="0.01" /></label>
      <label className={label}>Monthly salary (USD)<Input name="monthlySalary" type="number" min="0.01" step="0.01" /></label>
      <label className={label}>Effective from<Input name="effectiveFrom" type="date" required /></label>
      <label className={label}>Effective to (optional)<Input name="effectiveTo" type="date" /></label>
      <div className="md:col-span-2 flex items-end"><Button type="submit">Save employment profile</Button></div>
    </form></Card>
    <DataTableCard><Table><thead><tr><TableHead>Worker</TableHead><TableHead>Terms</TableHead><TableHead>Effective</TableHead><TableHead>Status</TableHead></tr></thead><tbody>{profiles.length ? profiles.map((profile) => <tr key={profile.id}><TableCell className="font-semibold">{profile.user.fullName}<div className="text-xs text-slate-500">{profile.user.role}</div></TableCell><TableCell>{profile.compensationType === "DAILY" ? `$${profile.dailyRate?.toFixed(2)} / day` : `$${profile.monthlySalary?.toFixed(2)} / month`}</TableCell><TableCell>{profile.effectiveFrom.toLocaleDateString()} – {profile.effectiveTo?.toLocaleDateString() ?? "ongoing"}</TableCell><TableCell><ToneBadge tone={profile.status === "ACTIVE" ? "green" : "slate"}>{profile.status}</ToneBadge></TableCell></tr>) : <tr><TableCell colSpan={4} className="py-10 text-center">No employment profiles configured.</TableCell></tr>}</tbody></Table></DataTableCard>
  </AdminPage>;
}
