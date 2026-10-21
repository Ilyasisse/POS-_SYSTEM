import CatalogWorkspace from "./CatalogWorkspace";
import {
  getCatalogData,
  type CatalogSearchParams,
} from "@/lib/catalog/queries";
import type { CatalogKind } from "@/lib/catalog/catalog";

export default async function CatalogPage({
  kind,
  searchParams,
  editorId,
}: {
  kind: CatalogKind;
  searchParams: Promise<CatalogSearchParams>;
  editorId?: string;
}) {
  const data = await getCatalogData(kind, await searchParams, editorId);
  return <CatalogWorkspace data={data} />;
}
