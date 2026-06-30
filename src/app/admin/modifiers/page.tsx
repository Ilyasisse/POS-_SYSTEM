import { Button } from "@/components/ui/button";
import {
  PaginationBar,
  AdminPage,
  PrimaryLink,
  RowActions,
  SearchToolbar,
  NativeSelect,
  Table,
  DataTableCard,
  TableCell,
  TableHead,
  StatusBadge,
} from "@/components/admin/shared";
import { queryStringWithoutPage } from "@/components/admin/shared/ui/queryStringWithoutPage";
import { prisma } from "@/lib/prisma";

type AdminModifiersPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
  }>;
};

export default async function AdminModifiersPage({
  searchParams,
}: AdminModifiersPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(Number(params.page) || 1, 1);
  const pageSize = 10;
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "all";
  const where = {
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    ...(status === "active"
      ? { isActive: true }
      : status === "inactive"
        ? { isActive: false }
        : {}),
  };

  const [modifiersList, totalModifiers] = await Promise.all([
    prisma.modifier.findMany({
      where,
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        product: true,
        modifierGroup: true,
      },
    }),
    prisma.modifier.count({ where }),
  ]);

  const totalPages = Math.max(Math.ceil(totalModifiers / pageSize), 1);

  return (
    <AdminPage
      title="Modifiers"
      description="Manage add-ons and extra options"
      action={
        <PrimaryLink href="/admin/modifiers/new">Add Modifier</PrimaryLink>
      }
    >
      <DataTableCard
        footer={
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            totalLabel={`Showing ${modifiersList.length} of ${totalModifiers} modifiers`}
            baseQuery={queryStringWithoutPage(params)}
          />
        }
      >
        <SearchToolbar placeholder="Search modifiers..." defaultValue={q}>
          <NativeSelect name="status" defaultValue={status}>
            <option value="all">Status All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </NativeSelect>
          <Button
            type="button"
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Filter
          </Button>
        </SearchToolbar>
        <Table>
          <thead>
            <tr>
              <TableHead>#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </tr>
          </thead>
          <tbody>
            {modifiersList.length === 0 ? (
              <tr>
                <TableCell colSpan={7} className="py-10 text-center">
                  No modifiers found.
                </TableCell>
              </tr>
            ) : (
              modifiersList.map((modifier, index) => (
                <tr key={modifier.id} className="border-b border-slate-50">
                  <TableCell className="font-bold text-slate-400">
                    {(currentPage - 1) * pageSize + index + 1}
                  </TableCell>
                  <TableCell className="font-black text-slate-950">
                    {modifier.name}
                  </TableCell>
                  <TableCell>
                    {modifier.modifierGroup?.name ?? "Option"}
                  </TableCell>
                  <TableCell>{modifier.product?.name ?? "-"}</TableCell>
                  <TableCell>${Number(modifier.price).toFixed(2)}</TableCell>
                  <TableCell>
                    <StatusBadge active={modifier.isActive} />
                  </TableCell>
                  <TableCell>
                    <RowActions editHref={`/admin/modifiers/${modifier.id}`} />
                  </TableCell>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
