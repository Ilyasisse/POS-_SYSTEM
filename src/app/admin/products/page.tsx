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

type AdminProductsPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    category?: string;
    status?: string;
  }>;
};

export default async function AdminProductsPage({
  searchParams,
}: AdminProductsPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(Number(params.page) || 1, 1);
  const pageSize = 10;
  const q = params.q?.trim() ?? "";
  const category = params.category ?? "all";
  const status = params.status ?? "all";
  const where = {
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    ...(category !== "all" ? { categoryId: category } : {}),
    ...(status === "active"
      ? { isActive: true }
      : status === "inactive"
        ? { isActive: false }
        : {}),
  };

  const [productsList, totalProducts, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        category: true,
      },
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  const totalPages = Math.max(Math.ceil(totalProducts / pageSize), 1);

  return (
    <AdminPageFrame
      
      title="Products"
      description="Manage your menu items and pricing"
      action={<AdminPrimaryLink href="/admin/products/new">Add Product</AdminPrimaryLink>}
    >
      <AdminTableShell
        footer={
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalLabel={`Showing ${productsList.length} of ${totalProducts} products`}
            baseQuery={queryStringWithoutPage(params)}
          />
        }
      >
        <AdminSearchToolbar placeholder="Search products..." defaultValue={q}>
          <AdminSelect name="category" defaultValue={category}>
            <option value="all">Category All</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </AdminSelect>
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
              <AdminTh>Image</AdminTh>
              <AdminTh>Name</AdminTh>
              <AdminTh>Category</AdminTh>
              <AdminTh>Price</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Stock</AdminTh>
              <AdminTh>Action</AdminTh>
            </tr>
          </thead>
          <tbody>
            {productsList.length === 0 ? (
              <tr>
                <AdminTd colSpan={8} className="py-10 text-center">
                  No products found.
                </AdminTd>
              </tr>
            ) : (
              productsList.map((product, index) => (
                <tr key={product.id} className="border-b border-slate-50">
                  <AdminTd className="font-bold text-slate-400">
                    {(currentPage - 1) * pageSize + index + 1}
                  </AdminTd>
                  <AdminTd>
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="size-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="grid size-10 place-items-center rounded-lg bg-orange-50 text-lg">
                        {product.name[0] ?? "P"}
                      </div>
                    )}
                  </AdminTd>
                  <AdminTd className="font-black text-slate-950">
                    {product.name}
                  </AdminTd>
                  <AdminTd>{product.category?.name ?? "-"}</AdminTd>
                  <AdminTd>${Number(product.price).toFixed(2)}</AdminTd>
                  <AdminTd>
                    <StatusBadge active={product.isActive} />
                  </AdminTd>
                  <AdminTd>{product.trackStock ? product.stockQty : "-"}</AdminTd>
                  <AdminTd>
                    <AdminRowActions editHref={`/admin/products/${product.id}`} />
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
