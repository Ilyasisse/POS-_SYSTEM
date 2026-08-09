import "server-only";
import { createClient } from "@supabase/supabase-js";

export type ReportInvalidation = { domain: "attendance" | "payroll" | "expense" | "supplier" | "customer" | "inventory" | "kitchen" | "operations" | "sales"; entityType: string; entityId: string; eventTime: string };

/** Best-effort only: mutations remain committed even when realtime is unavailable. */
export async function publishReportInvalidation(event: Omit<ReportInvalidation, "eventTime">) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const channel = client.channel("private:report-invalidations", { config: { private: true } });
    await channel.subscribe();
    const result = await channel.send({ type: "broadcast", event: "invalidate", payload: { ...event, eventTime: new Date().toISOString() } satisfies ReportInvalidation });
    await client.removeChannel(channel);
    return result === "ok";
  } catch { return false; }
}
