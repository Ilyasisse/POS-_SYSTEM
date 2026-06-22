import {
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
} from "@/components/admin/AdminUi";
import { prisma } from "@/lib/prisma";

type ModifierGroupsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
};

export default async function ModifierGroupsPage({
  searchParams,
}: ModifierGroupsPageProps) {
  const params = await searchParams;
  const q = params?.q?.trim() ?? "";
  const status = params?.status ?? "all";
  const groups = await prisma.modifierGroup.findMany({
    where: {
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      ...(status === "active"
        ? { isActive: true }
        : status === "inactive"
          ? { isActive: false }
          : {}),
    },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          modifiers: true,
        },
      },
    },
  });

  return (
    <AdminPageFrame
      title="Modifier Groups"
      description="Group modifiers for every selection"
      action={
        <AdminPrimaryLink href="/admin/modifier-groups/new">
          Add Group
        </AdminPrimaryLink>
      }
    >
      <AdminTableShell
        footer={
          <p className="text-sm font-medium text-slate-500">
            Showing 1 to {groups.length} of {groups.length} groups
          </p>
        }
      >
        <AdminSearchToolbar placeholder="Search groups..." defaultValue={q}>
          <AdminSelect name="status" defaultValue={status}>
            <option value="all">Status All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </AdminSelect>
          <button
            type="button"
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Filter
          </button>
        </AdminSearchToolbar>
        <AdminTable>
          <thead>
            <tr>
              <AdminTh>#</AdminTh>
              <AdminTh>Name</AdminTh>
              <AdminTh>Selection Type</AdminTh>
              <AdminTh>Min</AdminTh>
              <AdminTh>Max</AdminTh>
              <AdminTh>Modifiers</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Action</AdminTh>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <AdminTd colSpan={8} className="py-10 text-center">
                  No modifier groups found.
                </AdminTd>
              </tr>
            ) : (
              groups.map((group, index) => (
                <tr key={group.id} className="border-b border-slate-50">
                  <AdminTd className="font-bold text-slate-400">
                    {index + 1}
                  </AdminTd>
                  <AdminTd className="font-black text-slate-950">
                    {group.name}
                  </AdminTd>
                  <AdminTd>
                    {group.isRequired ? "Required" : "Optional"}
                  </AdminTd>
                  <AdminTd>{group.minSelect}</AdminTd>
                  <AdminTd>{group.maxSelect}</AdminTd>
                  <AdminTd>{group._count.modifiers}</AdminTd>
                  <AdminTd>
                    <StatusBadge active={group.isActive} />
                  </AdminTd>
                  <AdminTd>
                    <AdminRowActions
                      editHref={`/admin/modifier-groups/${group.id}`}
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
