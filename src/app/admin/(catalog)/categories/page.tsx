import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import {
  PaginationBar,
  AdminPage,
  PrimaryLink,
  RowActions,
  SearchToolbar,
  Table,
  DataTableCard,
  TableCell,
  TableHead,
  StatusBadge,
} from "@/components/admin/shared";
import { queryStringWithoutPage } from "@/components/admin/shared/ui/queryStringWithoutPage";
import { normalizeFilterChoice } from "@/lib/admin/admin-filters";
import { prisma } from "@/lib/prisma";

type AdminCategoriesPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
  }>;
};

export default async function AdminCategoriesPage({
  searchParams,
}: AdminCategoriesPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(Number(params.page) || 1, 1);
  const pageSize = 10;
  const q = params.q?.trim() ?? "";
  const status = normalizeFilterChoice(
    params.status,
    ["all", "active", "inactive"] as const,
    "all",
  );
  const where = {
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    ...(status === "active"
      ? { isActive: true }
      : status === "inactive"
        ? { isActive: false }
        : {}),
  };

  const [categoriesList, totalCategories] = await Promise.all([
    prisma.category.findMany({
      where,
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      orderBy: {
        sortOrder: "asc",
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    }),
    prisma.category.count({ where }),
  ]);

  const totalPages = Math.max(Math.ceil(totalCategories / pageSize), 1);

  return (
    <AdminPage
      title="Categories"
      description="Manage your menu categories"
      action={
        <PrimaryLink href="/admin/categories/new">Add Category</PrimaryLink>
      }
    >
      <DataTableCard
        footer={
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            totalLabel={`Showing ${categoriesList.length} of ${totalCategories} categories`}
            baseQuery={queryStringWithoutPage(params)}
          />
        }
      >
        <SearchToolbar
          placeholder="Search categories..."
          defaultValue={q}
          hasActiveFilters={Boolean(q || status !== "all")}
          clearHref="/admin/categories"
        >
          <AutoSubmitSelect name="status" defaultValue={status}>
            <option value="all">Status All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </AutoSubmitSelect>
        </SearchToolbar>
        <Table>
          <thead>
            <tr>
              <TableHead>#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Action</TableHead>
            </tr>
          </thead>
          <tbody>
            {categoriesList.length === 0 ? (
              <tr>
                <TableCell colSpan={6} className="py-10 text-center">
                  No categories found.
                </TableCell>
              </tr>
            ) : (
              categoriesList.map((category, index) => (
                <tr key={category.id} className="border-b border-slate-50">
                  <TableCell className="font-bold text-slate-400">
                    {(currentPage - 1) * pageSize + index + 1}
                  </TableCell>
                  <TableCell className="font-black text-slate-950">
                    {category.name}
                  </TableCell>
                  <TableCell>
                    {category.station
                      ? `${category.station} station category`
                      : "Menu category"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={category.isActive} />
                  </TableCell>
                  <TableCell>{category._count.products}</TableCell>
                  <TableCell>
                    <RowActions editHref={`/admin/categories/${category.id}`} />
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
