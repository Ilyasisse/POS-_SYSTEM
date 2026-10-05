import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { AdminPage, Button, Card, ToneBadge } from "@/components/admin/shared";
import { ToastOnMount } from "@/components/ui/toast";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  createTableQrToken,
  getTableQrSecret,
} from "@/lib/customer-orders/table-qr-token";
import { prisma } from "@/lib/prisma";
import { rotateTableQrCode, setTableQrOrdering } from "./actions";

export const dynamic = "force-dynamic";

type TableQrPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

function getNotice(status?: string) {
  switch (status) {
    case "enabled":
      return { tone: "success" as const, message: "Table ordering is enabled." };
    case "disabled":
      return { tone: "success" as const, message: "Table ordering is disabled." };
    case "rotated":
      return { tone: "success" as const, message: "A replacement QR code is ready. The previous code no longer works." };
    case "invalid_table":
      return { tone: "error" as const, message: "That active table could not be found." };
    case "update_failed":
      return { tone: "error" as const, message: "The QR setting could not be updated." };
    default:
      return null;
  }
}

function configuredOrigin() {
  const configured =
    process.env.APP_BASE_URL ??
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) return null;

  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

async function getRequestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    return "http://localhost:3000";
  }

  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : host.startsWith("localhost")
      ? "http"
      : "https";

  return `${protocol}://${host}`;
}

export default async function TableQrPage({ searchParams }: TableQrPageProps) {
  await requirePermission(PERMISSIONS.TABLE_MANAGE);

  const [params, tables, requestOrigin] = await Promise.all([
    searchParams,
    prisma.table.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        qrOrderingEnabled: true,
        qrTokenVersion: true,
      },
    }),
    getRequestOrigin(),
  ]);
  const notice = getNotice(params?.status);

  let secret: string | null = null;
  try {
    secret = getTableQrSecret();
  } catch {
    // The page stays available so an administrator can see the setup action.
  }

  const origin = configuredOrigin() ?? requestOrigin;
  const tableCards = await Promise.all(
    tables.map(async (table) => {
      if (!secret) return { ...table, orderUrl: null, qrDataUrl: null };

      const token = createTableQrToken(table.id, table.qrTokenVersion, secret);
      const orderUrl = `${origin}/table/${encodeURIComponent(token)}`;
      const qrDataUrl = await QRCode.toDataURL(orderUrl, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 480,
      });

      return { ...table, orderUrl, qrDataUrl };
    }),
  );

  return (
    <AdminPage
      title="Table QR codes"
      description="Print signed ordering codes and control which tables accept customer orders."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/tables">Back to tables</Link>
        </Button>
      }
    >
      {notice ? <ToastOnMount tone={notice.tone} description={notice.message} /> : null}

      {!secret ? (
        <Card className="border-amber-300 bg-amber-50 p-5 text-amber-950">
          <h2 className="font-black">QR ordering needs one environment variable</h2>
          <p className="mt-2 text-sm">
            Add <code>TABLE_QR_SECRET</code> with at least 32 random characters, then redeploy. Codes are not generated until the secret is configured.
          </p>
        </Card>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {tableCards.map((table) => (
          <Card key={table.id} className="overflow-hidden p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Dine-in ordering</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">{table.name}</h2>
              </div>
              <ToneBadge tone={table.qrOrderingEnabled ? "green" : "slate"}>
                {table.qrOrderingEnabled ? "Enabled" : "Disabled"}
              </ToneBadge>
            </div>

            {table.qrDataUrl ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <Image
                  src={table.qrDataUrl}
                  alt={`Ordering QR code for ${table.name}`}
                  width={480}
                  height={480}
                  unoptimized
                  className="mx-auto h-auto w-full max-w-64"
                />
              </div>
            ) : null}

            {table.orderUrl ? (
              <p className="mt-3 break-all text-xs text-slate-500">{table.orderUrl}</p>
            ) : null}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <form action={setTableQrOrdering}>
                <input type="hidden" name="tableId" value={table.id} />
                <input type="hidden" name="enabled" value={table.qrOrderingEnabled ? "false" : "true"} />
                <Button type="submit" variant={table.qrOrderingEnabled ? "outline" : "default"} className="w-full">
                  {table.qrOrderingEnabled ? "Disable" : "Enable"}
                </Button>
              </form>
              <form action={rotateTableQrCode}>
                <input type="hidden" name="tableId" value={table.id} />
                <Button type="submit" variant="outline" className="w-full" disabled={!secret}>
                  Replace code
                </Button>
              </form>
            </div>
          </Card>
        ))}
      </section>
    </AdminPage>
  );
}
