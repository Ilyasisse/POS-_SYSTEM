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
    <AdminPageFrame
      title="Modifiers"
      description="Manage add-ons and extra options"
      action={
        <AdminPrimaryLink href="/admin/modifiers/new">
          Add Modifier
        </AdminPrimaryLink>
      }
    >
      <AdminTableShell
        footer={
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalLabel={`Showing ${modifiersList.length} of ${totalModifiers} modifiers`}
            baseQuery={queryStringWithoutPage(params)}
          />
        }
      >
        <AdminSearchToolbar placeholder="Search modifiers..." defaultValue={q}>
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
              <AdminTh>Type</AdminTh>
              <AdminTh>Product</AdminTh>
              <AdminTh>Price</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Action</AdminTh>
            </tr>
          </thead>
          <tbody>
            {modifiersList.length === 0 ? (
              <tr>
                <AdminTd colSpan={7} className="py-10 text-center">
                  No modifiers found.
                </AdminTd>
              </tr>
            ) : (
              modifiersList.map((modifier, index) => (
                <tr key={modifier.id} className="border-b border-slate-50">
                  <AdminTd className="font-bold text-slate-400">
                    {(currentPage - 1) * pageSize + index + 1}
                  </AdminTd>
                  <AdminTd className="font-black text-slate-950">
                    {modifier.name}
                  </AdminTd>
                  <AdminTd>{modifier.modifierGroup?.name ?? "Option"}</AdminTd>
                  <AdminTd>{modifier.product?.name ?? "-"}</AdminTd>
                  <AdminTd>${Number(modifier.price).toFixed(2)}</AdminTd>
                  <AdminTd>
                    <StatusBadge active={modifier.isActive} />
                  </AdminTd>
                  <AdminTd>
                    <AdminRowActions
                      editHref={`/admin/modifiers/${modifier.id}`}
                    />
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
