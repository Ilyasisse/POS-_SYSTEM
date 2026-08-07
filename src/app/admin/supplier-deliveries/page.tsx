import { redirect } from "next/navigation";

const LEGACY_STATUS_MAP: Record<string, string> = {
  PENDING_EXTRACTION: "DRAFT",
  PENDING_VERIFICATION: "DRAFT",
  VERIFIED: "FINALIZED",
  REJECTED: "VOID",
};

export default async function LegacySupplierDeliveriesRedirect({
  searchParams,
}: {
  searchParams?: Promise<{ supplier?: string; status?: string }>;
}) {
  const legacy = (await searchParams) ?? {};
  const query = new URLSearchParams();
  if (legacy.supplier) query.set("supplier", legacy.supplier);
  const status = legacy.status ? LEGACY_STATUS_MAP[legacy.status] : undefined;
  if (status) query.set("status", status);
  redirect(
    query.size
      ? `/admin/supplier-invoices?${query.toString()}`
      : "/admin/supplier-invoices",
  );
}
