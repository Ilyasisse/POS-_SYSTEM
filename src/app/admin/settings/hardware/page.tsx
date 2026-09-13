import Link from "next/link";
import { AdminPage, Button, Card, MetricCard } from "@/components/admin/shared";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  getGatewayHealth,
  type GatewayHealthState,
} from "@/lib/payments/gateway-health";
import {
  expectedMacrodroidSender,
  MACRODROID_GATEWAY_ID,
  resolveMacrodroidSecret,
} from "@/lib/payments/macrodroid-auth";
import { prisma } from "@/lib/prisma";

const statePresentation: Record<
  GatewayHealthState,
  { label: string; className: string; explanation: string }
> = {
  ONLINE: {
    label: "Online",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    explanation: "Heartbeats are arriving normally.",
  },
  DEGRADED: {
    label: "Delayed",
    className: "border-amber-200 bg-amber-50 text-amber-900",
    explanation: "The latest heartbeat is late. Check the phone before taking payment.",
  },
  OFFLINE: {
    label: "Offline",
    className: "border-red-200 bg-red-50 text-red-900",
    explanation: "No recent heartbeat has arrived. Automatic payment confirmation is unavailable.",
  },
  NEVER_CONNECTED: {
    label: "Never connected",
    className: "border-red-200 bg-red-50 text-red-900",
    explanation: "The webhook is configured, but this phone has never sent a heartbeat.",
  },
  UNCONFIGURED: {
    label: "Not configured",
    className: "border-slate-200 bg-slate-50 text-slate-900",
    explanation: "Configure the MacroDroid webhook secret before using automatic confirmation.",
  },
};

function formatNairobi(value: Date | null) {
  return value
    ? value.toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })
    : "Never";
}

export default async function PaymentPhoneHealthPage() {
  await requirePermission(PERMISSIONS.PAYMENT_RECEIPT_MANAGE);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [gateway, receiptGroups, latestReview] = await Promise.all([
    prisma.paymentGatewayStatus.findUnique({
      where: { id: MACRODROID_GATEWAY_ID },
    }),
    prisma.mobileMoneyReceipt.groupBy({
      by: ["direction", "status"],
      where: { receivedAt: { gte: since } },
      _count: true,
    }),
    prisma.mobileMoneyReceipt.findFirst({
      where: { status: "NEEDS_REVIEW" },
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true, parseError: true },
    }),
  ]);
  const health = getGatewayHealth({
    configured: Boolean(resolveMacrodroidSecret()),
    lastHeartbeatAt: gateway?.lastHeartbeatAt ?? null,
    now,
  });
  const presentation = statePresentation[health.state];
  const count = (direction: "INCOMING" | "OUTGOING" | "UNKNOWN", status?: "AVAILABLE" | "ASSIGNED" | "OUTGOING" | "NEEDS_REVIEW") =>
    receiptGroups
      .filter((row) => row.direction === direction && (!status || row.status === status))
      .reduce((sum, row) => sum + row._count, 0);
  const needsReview = receiptGroups
    .filter((row) => row.status === "NEEDS_REVIEW")
    .reduce((sum, row) => sum + row._count, 0);

  return (
    <AdminPage
      title="Payment phone health"
      description="Monitor the Golis SMS gateway without exposing webhook secrets or payment contents."
      action={<Button asChild variant="outline"><Link href="/admin/settings">Back to settings</Link></Button>}
    >
      <section className={`rounded-2xl border p-5 ${presentation.className}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide">MacroDroid gateway</p>
            <h2 className="mt-1 text-3xl font-black">{presentation.label}</h2>
            <p className="mt-2 max-w-2xl text-sm">{presentation.explanation}</p>
          </div>
          <div className="text-sm">
            <p><strong>Expected sender:</strong> {expectedMacrodroidSender()}</p>
            <p><strong>Heartbeat age:</strong> {health.ageSeconds == null ? "Unavailable" : `${health.ageSeconds} seconds`}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Last heartbeat" value={formatNairobi(gateway?.lastHeartbeatAt ?? null)} />
        <MetricCard label="Last payment SMS" value={formatNairobi(gateway?.lastReceiptAt ?? null)} />
        <MetricCard label="Incoming · 24h" value={count("INCOMING")} helper={`${count("INCOMING", "ASSIGNED")} assigned`} />
        <MetricCard label="Needs review · 24h" value={needsReview} helper={latestReview?.parseError ?? "No parsing errors"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-lg font-bold">Recovery checklist</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Confirm the Samsung phone has mobile data or café Wi-Fi.</li>
            <li>Disable battery optimization for MacroDroid and keep its background permission enabled.</li>
            <li>Open MacroDroid and confirm the heartbeat and SMS-forwarding macros are enabled.</li>
            <li>Send a test heartbeat, then refresh this page before accepting another transfer.</li>
          </ol>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-bold">Last review item</h2>
          {latestReview ? (
            <div className="mt-3 space-y-2 text-sm">
              <p><strong>Received:</strong> {formatNairobi(latestReview.receivedAt)}</p>
              <p className="rounded-lg bg-muted p-3 text-muted-foreground">{latestReview.parseError ?? "Manual review required."}</p>
              <p>Open the cashier receipt inbox to inspect and assign it safely.</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No receipt currently needs manual review.</p>
          )}
        </Card>
      </section>
    </AdminPage>
  );
}
