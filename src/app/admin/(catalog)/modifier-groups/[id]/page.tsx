import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { updateModifierGroup, deleteModifierGroup } from "../actions";

type ModifierGroupPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ModifierGroupPage({
  params,
}: ModifierGroupPageProps) {
  const { id } = await params;

  const group = await prisma.modifierGroup.findUnique({
    where: { id },
  });

  if (!group) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-2xl bg-card p-4 shadow">
          <h1 className="text-2xl font-bold">{group.name}</h1>
        </header>

        <section className="rounded-2xl bg-card p-6 shadow">
          <form action={updateModifierGroup} className="space-y-4">
            <Input type="hidden" name="id" value={group.id} />

            <div>
              <label
                htmlFor="edit-modifier-group-name"
                className="mb-1 block text-sm font-medium"
              >
                Group Name
              </label>
              <Input
                id="edit-modifier-group-name"
                name="name"
                defaultValue={group.name}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label
                htmlFor="edit-modifier-group-min-select"
                className="mb-1 block text-sm font-medium"
              >
                Minimum selections
              </label>
              <Input
                id="edit-modifier-group-min-select"
                name="minSelect"
                type="number"
                defaultValue={group.minSelect}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label
                htmlFor="edit-modifier-group-max-select"
                className="mb-1 block text-sm font-medium"
              >
                Maximum selections
              </label>
              <Input
                id="edit-modifier-group-max-select"
                name="maxSelect"
                type="number"
                defaultValue={group.maxSelect}
                className="w-full rounded border p-2"
              />
            </div>

            <label
              htmlFor="edit-modifier-group-active"
              className="flex items-center gap-2 text-md"
            >
              <Input
                id="edit-modifier-group-active"
                type="checkbox"
                name="isActive"
                className="h-4 w-4 shrink-0"
                defaultChecked={group.isActive}
              />
              Active
            </label>

            <Button
              type="submit"
              className="rounded bg-primary px-4 py-2 text-primary-foreground"
            >
              Update
            </Button>
          </form>
        </section>

        <section className="rounded-2xl border border-red-200 dark:border-red-800 bg-card p-6 shadow">
          <h2 className="mb-3 font-bold text-red-600 dark:text-red-300">
            Delete Group
          </h2>

          <form action={deleteModifierGroup}>
            <Input type="hidden" name="id" value={group.id} />

            <Button
              type="submit"
              className="rounded bg-red-600 hover:bg-red-600/90 px-4 py-2 text-white"
            >
              Delete
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
