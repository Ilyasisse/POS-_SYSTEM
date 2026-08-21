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
import Image from "next/image";

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
  const status = normalizeFilterChoice(
    params.status,
    ["all", "active", "inactive"] as const,
    "all",
  );
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
    <AdminPage
      title="Products"
      description="Manage your menu items and pricing"
      action={<PrimaryLink href="/admin/products/new">Add Product</PrimaryLink>}
    >
      <DataTableCard
        footer={
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            totalLabel={`Showing ${productsList.length} of ${totalProducts} products`}
            baseQuery={queryStringWithoutPage(params)}
          />
        }
      >
        <SearchToolbar
          placeholder="Search products..."
          defaultValue={q}
          hasActiveFilters={Boolean(
            q || category !== "all" || status !== "all",
          )}
          clearHref="/admin/products"
        >
          <AutoSubmitSelect name="category" defaultValue={category}>
            <option value="all">Category All</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </AutoSubmitSelect>
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
              <TableHead>Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Action</TableHead>
            </tr>
          </thead>
          <tbody>
            {productsList.length === 0 ? (
              <tr>
                <TableCell colSpan={8} className="py-10 text-center">
                  No products found.
                </TableCell>
              </tr>
            ) : (
              productsList.map((product, index) => (
                <tr key={product.id} className="border-b border-slate-50">
                  <TableCell className="font-bold text-slate-400">
                    {(currentPage - 1) * pageSize + index + 1}
                  </TableCell>
                  <TableCell>
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized
                        className="size-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="grid size-10 place-items-center rounded-lg bg-orange-50 text-lg">
                        {product.name[0] ?? "P"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-black text-slate-950">
                    {product.name}
                  </TableCell>
                  <TableCell>{product.category?.name ?? "-"}</TableCell>
                  <TableCell>${Number(product.price).toFixed(2)}</TableCell>
                  <TableCell>
                    <StatusBadge active={product.isActive} />
                  </TableCell>
                  <TableCell>
                    {product.trackStock ? product.stockQty : "-"}
                  </TableCell>
                  <TableCell>
                    <RowActions editHref={`/admin/products/${product.id}`} />
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
