import { Button } from "@/components/ui/button";
import {
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
    <AdminPage
      title="Modifier Groups"
      description="Group modifiers for every selection"
      action={
        <PrimaryLink href="/admin/modifier-groups/new">Add Group</PrimaryLink>
      }
    >
      <DataTableCard
        footer={
          <p className="text-sm font-medium text-slate-500">
            Showing 1 to {groups.length} of {groups.length} groups
          </p>
        }
      >
        <SearchToolbar placeholder="Search groups..." defaultValue={q}>
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
              <TableHead>Selection Type</TableHead>
              <TableHead>Min</TableHead>
              <TableHead>Max</TableHead>
              <TableHead>Modifiers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <TableCell colSpan={8} className="py-10 text-center">
                  No modifier groups found.
                </TableCell>
              </tr>
            ) : (
              groups.map((group, index) => (
                <tr key={group.id} className="border-b border-slate-50">
                  <TableCell className="font-bold text-slate-400">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-black text-slate-950">
                    {group.name}
                  </TableCell>
                  <TableCell>
                    {group.isRequired ? "Required" : "Optional"}
                  </TableCell>
                  <TableCell>{group.minSelect}</TableCell>
                  <TableCell>{group.maxSelect}</TableCell>
                  <TableCell>{group._count.modifiers}</TableCell>
                  <TableCell>
                    <StatusBadge active={group.isActive} />
                  </TableCell>
                  <TableCell>
                    <RowActions
                      editHref={`/admin/modifier-groups/${group.id}`}
                    />
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
