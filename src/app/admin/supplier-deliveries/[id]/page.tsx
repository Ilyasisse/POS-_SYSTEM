import { redirect } from "next/navigation";

export default async function LegacySupplierDeliveryRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/supplier-invoices/${encodeURIComponent(id)}`);
}
