import CatalogPage from "@/components/admin/catalog/CatalogPage";
import type { CatalogSearchParams } from "@/lib/catalog/queries";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  return (
    <CatalogPage
      kind="modifier-groups"
      searchParams={searchParams}
      editorId="new"
    />
  );
}
