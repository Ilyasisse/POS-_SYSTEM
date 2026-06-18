import {
  AdminPagination,
  AdminPageFrame,
  AdminPrimaryLink,
  AdminRowActions,
  AdminSearchToolbar,
  AdminSelect,
  AdminTable,
  AdminTableShell,
  AdminTd,
  AdminTh,
  StatusBadge,
  queryStringWithoutPage,
} from "@/components/admin/AdminUi";
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
  const status = params.status ?? "all";
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
    <AdminPageFrame
      
      title="Categories"
      description="Manage your menu categories"
      action={<AdminPrimaryLink href="/admin/categories/new">Add Category</AdminPrimaryLink>}
    >
      <AdminTableShell
        footer={
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalLabel={`Showing ${categoriesList.length} of ${totalCategories} categories`}
            baseQuery={queryStringWithoutPage(params)}
          />
        }
      >
        <AdminSearchToolbar placeholder="Search categories..." defaultValue={q}>
          <AdminSelect name="status" defaultValue={status}>
            <option value="all">Status All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </AdminSelect>
          <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">
            Filter
          </button>
        </AdminSearchToolbar>
        <AdminTable>
          <thead>
            <tr>
              <AdminTh>#</AdminTh>
              <AdminTh>Name</AdminTh>
              <AdminTh>Description</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Items</AdminTh>
              <AdminTh>Action</AdminTh>
            </tr>
          </thead>
          <tbody>
            {categoriesList.length === 0 ? (
              <tr>
                <AdminTd colSpan={6} className="py-10 text-center">
                  No categories found.
                </AdminTd>
              </tr>
            ) : (
              categoriesList.map((category, index) => (
                <tr key={category.id} className="border-b border-slate-50">
                  <AdminTd className="font-bold text-slate-400">
                    {(currentPage - 1) * pageSize + index + 1}
                  </AdminTd>
                  <AdminTd className="font-black text-slate-950">
                    {category.name}
                  </AdminTd>
                  <AdminTd>
                    {category.station
                      ? `${category.station} station category`
                      : "Menu category"}
                  </AdminTd>
                  <AdminTd>
                    <StatusBadge active={category.isActive} />
                  </AdminTd>
                  <AdminTd>{category._count.products}</AdminTd>
                  <AdminTd>
                    <AdminRowActions editHref={`/admin/categories/${category.id}`} />
                  </AdminTd>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>
      </AdminTableShell>
    </AdminPageFrame>
  );
}
