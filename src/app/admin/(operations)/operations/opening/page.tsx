import Link from "next/link";
import { AdminPage, Card } from "@/components/admin/shared";
import { ToastOnMount } from "@/components/ui/toast";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  getOpeningBusinessDate,
  canSignOffOpeningTasks,
} from "@/lib/operations/opening-readiness-rules";
import { prisma } from "@/lib/prisma";
import {
  setOpeningTaskAction,
  signOffOpeningAction,
  startOpeningAction,
} from "./actions";

type Props = { searchParams: Promise<{ result?: string }> };

export default async function OpeningReadinessPage({ searchParams }: Props) {
  const [user, params] = await Promise.all([
    requirePermission(PERMISSIONS.ADMIN_ACCESS),
    searchParams,
  ]);
  const businessDate = getOpeningBusinessDate();
  const day = await prisma.openingReadinessDay.findUnique({
    where: { businessDate },
    include: {
      startedBy: { select: { fullName: true } },
      signedBy: { select: { fullName: true } },
      tasks: {
        include: { checkedBy: { select: { fullName: true } } },
        orderBy: { key: "asc" },
      },
    },
  });
  const completed = day?.tasks.filter((task) => task.checkedAt).length ?? 0;
  const notice =
    params.result === "saved"
      ? { tone: "success" as const, description: "Opening checklist updated." }
      : params.result === "stale"
        ? {
            tone: "warning" as const,
            description:
              "The checklist changed or is incomplete. Review today's tasks and try again.",
          }
        : params.result === "failed"
          ? {
              tone: "error" as const,
              description: "The update failed. Refresh and try again.",
            }
          : null;

  return (
    <AdminPage
      title="Opening readiness"
      description="Daily manager acknowledgement of café opening tasks. Checks do not replace required safety records."
    >
      {notice ? <ToastOnMount {...notice} /> : null}
      <div className="mb-4">
        <Link
          href="/admin/operations"
          className="text-sm font-semibold text-emerald-700 hover:underline"
        >
          ← Kitchen &amp; Operations
        </Link>
      </div>
      <Card className="max-w-3xl space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold">
            {businessDate.toISOString().slice(0, 10)} · Café business day
          </h2>
          <p className="text-sm text-muted-foreground">
            Opening day rolls over at 07:00 Africa/Nairobi. This does not block
            orders or certify temperatures.
          </p>
        </div>
        {!day ? (
          <form action={startOpeningAction}>
            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Start today&apos;s checklist
            </button>
          </form>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Started by {day.startedBy.fullName} · {completed}/
              {day.tasks.length} checked
            </p>
            <ol className="space-y-2">
              {day.tasks.map((task) => (
                <li
                  key={task.key}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="font-medium">{task.label}</p>
                    {task.checkedAt ? (
                      <p className="text-xs text-emerald-700">
                        Checked by {task.checkedBy?.fullName ?? "staff"} at{" "}
                        {task.checkedAt.toLocaleString("en-US", {
                          timeZone: "Africa/Nairobi",
                        })}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700">Not yet checked</p>
                    )}
                  </div>
                  {!day.signedAt ? (
                    <form action={setOpeningTaskAction}>
                      <input type="hidden" name="key" value={task.key} />
                      <input
                        type="hidden"
                        name="checked"
                        value={task.checkedAt ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                      >
                        {task.checkedAt ? "Undo check" : "Mark checked"}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ol>
            {day.signedAt ? (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                Signed off by {day.signedBy?.fullName ?? "manager"} at{" "}
                {day.signedAt.toLocaleString("en-US", {
                  timeZone: "Africa/Nairobi",
                })}
              </p>
            ) : (
              <form action={signOffOpeningAction}>
                <button
                  type="submit"
                  disabled={!canSignOffOpeningTasks(day.tasks)}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sign off opening checklist
                </button>
                {!canSignOffOpeningTasks(day.tasks) ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Check every task to enable sign-off.
                  </p>
                ) : null}
              </form>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Viewing as {user.fullName}. All task changes and sign-off are audited.
        </p>
      </Card>
    </AdminPage>
  );
}
