import Link from "next/link";
import { ToastOnMount } from "@/components/ui/toast";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { createHandoverAction, resolveHandoverAction } from "./actions";

type Props = {
  searchParams: Promise<{ view?: string; page?: string; status?: string }>;
};
const pageSize = 25;

export default async function ShiftHandoverPage({ searchParams }: Props) {
  const [, params] = await Promise.all([
    requirePermission(PERMISSIONS.ORDER_MANAGE),
    searchParams,
  ]);
  const view = params.view === "resolved" ? "resolved" : "open";
  const requestedPage = Number(params.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage >= 1
      ? Math.min(requestedPage, 1000)
      : 1;
  const notes = await prisma.shiftHandoverNote.findMany({
    where: { resolvedAt: view === "open" ? null : { not: null } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    include: {
      createdBy: { select: { fullName: true } },
      resolvedBy: { select: { fullName: true } },
    },
  });
  const hasNext = notes.length > pageSize;
  const messages: Record<
    string,
    { tone: "success" | "warning" | "error"; description: string }
  > = {
    created: { tone: "success", description: "Shift handover note saved." },
    duplicate: {
      tone: "warning",
      description: "This note was already submitted. Refresh to write another.",
    },
    invalid: {
      tone: "error",
      description: "Check the title and details, then resubmit.",
    },
    resolved: { tone: "success", description: "Shift handover note resolved." },
    stale: {
      tone: "warning",
      description:
        "The note changed or the resolution is incomplete. Refresh and retry.",
    },
    failed: {
      tone: "error",
      description: "Could not save the change. Refresh and retry.",
    },
  };
  const notice = params.status ? messages[params.status] : null;

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <Link
        href="/cashier"
        className="text-sm font-semibold text-emerald-700 hover:underline"
      >
        ← Cashier
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Front-of-house shift handover</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leave operational tasks for the next shift. This board does not change
          payments, table assignments, or incident records.
        </p>
      </header>
      {notice ? <ToastOnMount {...notice} /> : null}
      <form
        action={createHandoverAction}
        className="space-y-3 rounded-xl border border-border bg-card p-4"
      >
        <h2 className="font-semibold">Leave a handover note</h2>
        <input type="hidden" name="requestToken" value={crypto.randomUUID()} />
        <label className="block text-sm font-medium">
          Title
          <input
            name="title"
            required
            minLength={5}
            maxLength={120}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2"
            placeholder="e.g. Follow up on reserved table"
          />
        </label>
        <label className="block text-sm font-medium">
          Details for the next shift
          <textarea
            name="details"
            required
            minLength={10}
            maxLength={1000}
            rows={3}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Save handover
        </button>
      </form>
      <nav
        aria-label="Handover status"
        className="flex gap-4 text-sm font-semibold"
      >
        <Link
          href="/cashier/handover"
          aria-current={view === "open" ? "page" : undefined}
          className={
            view === "open"
              ? "text-emerald-700 underline"
              : "text-muted-foreground"
          }
        >
          Open
        </Link>
        <Link
          href="/cashier/handover?view=resolved"
          aria-current={view === "resolved" ? "page" : undefined}
          className={
            view === "resolved"
              ? "text-emerald-700 underline"
              : "text-muted-foreground"
          }
        >
          Resolved
        </Link>
      </nav>
      <section className="space-y-3" aria-label={`${view} handover notes`}>
        {notes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No {view} handover notes on this page.
          </p>
        ) : null}
        {notes.slice(0, pageSize).map((note) => (
          <article
            key={note.id}
            className="space-y-2 rounded-xl border border-border bg-card p-4"
          >
            <h2 className="font-bold">{note.title}</h2>
            <p className="whitespace-pre-wrap text-sm">{note.details}</p>
            <p className="text-xs text-muted-foreground">
              From {note.createdBy.fullName} ·{" "}
              {note.createdAt.toLocaleString("en-US", {
                timeZone: "Africa/Nairobi",
              })}
            </p>
            {note.resolvedAt ? (
              <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900">
                Resolved by {note.resolvedBy?.fullName ?? "staff"}:{" "}
                {note.resolutionNote}
              </p>
            ) : (
              <form
                action={resolveHandoverAction}
                className="space-y-2 border-t border-border pt-3"
              >
                <input type="hidden" name="id" value={note.id} />
                <label className="block text-xs font-medium">
                  Resolution note
                  <textarea
                    name="resolutionNote"
                    required
                    minLength={3}
                    maxLength={1000}
                    rows={2}
                    className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-900"
                >
                  Mark resolved
                </button>
              </form>
            )}
          </article>
        ))}
      </section>
      <div className="flex gap-4 text-sm font-semibold">
        {page > 1 ? (
          <Link
            href={`/cashier/handover?view=${view}&page=${page - 1}`}
            className="text-emerald-700"
          >
            Previous
          </Link>
        ) : null}
        {hasNext ? (
          <Link
            href={`/cashier/handover?view=${view}&page=${page + 1}`}
            className="text-emerald-700"
          >
            Next
          </Link>
        ) : null}
      </div>
    </main>
  );
}
