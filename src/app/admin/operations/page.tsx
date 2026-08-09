import { AdminPage, Card, ToneBadge } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { KITCHEN_STATIONS } from "@/lib/kitchen/kitchen-socket";
import { prisma } from "@/lib/prisma";
import {
  completeCleaningRunAction,
  completeCleaningTaskAction,
  createCleaningTemplateAction,
  createIncidentAction,
  resolveIncidentAction,
  saveKitchenTargetAction,
  scheduleCleaningRunAction,
} from "./actions";

const fieldClass = "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm";

export default async function OperationsPage() {
  const user = await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  const [targets, incidents, templates, runs, staff] = await Promise.all([
    prisma.kitchenPreparationTarget.findMany({ orderBy: { station: "asc" } }),
    prisma.operationalIncident.findMany({ where: { status: "OPEN" }, include: { reportedBy: true, assignedTo: true }, orderBy: { startedAt: "desc" } }),
    prisma.cleaningChecklistTemplate.findMany({ where: { isActive: true }, include: { tasks: true }, orderBy: { name: "asc" } }),
    prisma.cleaningChecklistRun.findMany({ where: { status: { not: "COMPLETED" } }, include: { template: true, assignedTo: true, tasks: { include: { task: true } } }, orderBy: { scheduledFor: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  const canManageTargets = hasPermission(user, PERMISSIONS.KITCHEN_TARGET_MANAGE);
  const canManageIncidents = hasPermission(user, PERMISSIONS.OPERATIONS_INCIDENT_MANAGE);
  const canManageCleaning = hasPermission(user, PERMISSIONS.CLEANING_MANAGE);

  return (
    <AdminPage title="Kitchen & Operations" description="Preparation targets, quality incidents, operational outages, and cleaning evidence">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-black">Preparation targets</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {KITCHEN_STATIONS.map((station) => {
              const current = targets.find((target) => target.station === station);
              return (
                <form key={station} action={saveKitchenTargetAction} className="rounded-xl border p-3">
                  <input type="hidden" name="station" value={station} />
                  <p className="mb-2 text-sm font-bold">{station.replaceAll("_", " ")}</p>
                  <div className="flex gap-2">
                    <Input name="targetMinutes" type="number" min="1" max="240" defaultValue={current?.targetMinutes ?? 15} aria-label={`${station} target minutes`} disabled={!canManageTargets} />
                    <Button disabled={!canManageTargets}>Save</Button>
                  </div>
                </form>
              );
            })}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-black">Report operational incident</h2>
          <form action={createIncidentAction} className="grid gap-3 sm:grid-cols-2">
            <select name="type" className={fieldClass} aria-label="Incident type"><option>EQUIPMENT</option><option>POS</option><option>INTERNET</option></select>
            <select name="severity" className={fieldClass} aria-label="Incident severity"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select>
            <Input name="title" placeholder="Incident title" required />
            <select name="station" className={fieldClass} aria-label="Affected station"><option value="">All areas</option>{KITCHEN_STATIONS.map((station) => <option key={station}>{station}</option>)}</select>
            <textarea name="description" required placeholder="What happened?" className="min-h-24 rounded-lg border p-3 sm:col-span-2" />
            <select name="assignedToUserId" className={fieldClass} aria-label="Assign incident"><option value="">Unassigned</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}</select>
            <Button className="sm:w-fit">Record incident</Button>
          </form>
        </Card>
      </div>

      <Card className="space-y-3 p-5">
        <h2 className="text-lg font-black">Open incidents</h2>
        {incidents.length === 0 ? <p className="text-sm text-slate-500">No open incidents.</p> : incidents.map((incident) => (
          <div key={incident.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2"><strong>{incident.title}</strong><ToneBadge tone={incident.severity === "CRITICAL" || incident.severity === "HIGH" ? "red" : "amber"}>{incident.type} / {incident.severity}</ToneBadge></div>
            <p className="mt-2 text-sm">{incident.description}</p>
            <p className="mt-1 text-xs text-slate-500">Reported by {incident.reportedBy.fullName}{incident.assignedTo ? ` · Assigned to ${incident.assignedTo.fullName}` : ""}</p>
            {canManageIncidents ? <form action={resolveIncidentAction} className="mt-3 flex gap-2"><input type="hidden" name="incidentId" value={incident.id} /><Input name="resolutionNotes" placeholder="Resolution notes" required /><Button>Resolve</Button></form> : null}
          </div>
        ))}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-black">Cleaning templates</h2>
          {canManageCleaning ? <form action={createCleaningTemplateAction} className="grid gap-3">
            <Input name="name" placeholder="Checklist name" required />
            <select name="station" className={fieldClass} aria-label="Cleaning station"><option value="">All areas</option>{KITCHEN_STATIONS.map((station) => <option key={station}>{station}</option>)}</select>
            <Input name="schedule" placeholder="Schedule, e.g. Daily at 17:00" required />
            <textarea name="tasks" className="min-h-28 rounded-lg border p-3" placeholder="One required task per line" required />
            <Button className="w-fit">Create template</Button>
          </form> : null}
          {templates.map((template) => <div key={template.id} className="rounded-xl border p-3"><strong>{template.name}</strong><p className="text-xs text-slate-500">{template.schedule} · {template.tasks.length} tasks</p>{canManageCleaning ? <form action={scheduleCleaningRunAction} className="mt-2 grid gap-2 sm:grid-cols-3"><input type="hidden" name="templateId" value={template.id} /><Input name="scheduledFor" type="datetime-local" required /><select name="assignedToUserId" className={fieldClass} aria-label="Assign cleaning run"><option value="">Unassigned</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}</select><Button>Schedule</Button></form> : null}</div>)}
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-black">Active cleaning runs</h2>
          {runs.length === 0 ? <p className="text-sm text-slate-500">No pending cleaning runs.</p> : runs.map((run) => (
            <div key={run.id} className="rounded-xl border p-3">
              <strong>{run.template.name}</strong><p className="text-xs text-slate-500">Due {run.scheduledFor.toLocaleString("en-US", { timeZone: "Africa/Nairobi" })}{run.assignedTo ? ` · ${run.assignedTo.fullName}` : ""}</p>
              <div className="mt-3 space-y-2">{run.tasks.map((line) => <form key={line.id} action={completeCleaningTaskAction} className="flex items-center gap-2"><input type="hidden" name="runTaskId" value={line.id} /><span className={line.completed ? "line-through" : ""}>{line.task.label}</span>{!line.completed ? <><Input name="evidenceText" placeholder="Evidence note" className="ml-auto max-w-52" /><Button size="sm">Done</Button></> : null}</form>)}</div>
              <form action={completeCleaningRunAction} className="mt-3 grid gap-2"><input type="hidden" name="runId" value={run.id} /><Input name="evidenceNote" placeholder="Completion evidence note" /><Input name="evidenceUrl" type="url" placeholder="Optional evidence URL" /><Button className="w-fit">Complete run</Button></form>
            </div>
          ))}
        </Card>
      </div>
    </AdminPage>
  );
}
