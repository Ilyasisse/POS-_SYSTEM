import CatalogPage from "@/components/admin/catalog/CatalogPage";
import type { CatalogSearchParams } from "@/lib/catalog/queries";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<CatalogSearchParams>;
}) {
  const { id } = await params;
  return (
    <CatalogPage kind="products" searchParams={searchParams} editorId={id} />
  );
}
