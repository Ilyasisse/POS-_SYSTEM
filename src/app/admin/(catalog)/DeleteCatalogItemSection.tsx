import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DeleteCatalogItemSection({
  id,
  name,
  label,
  action,
}: {
  id: string;
  name: string;
  label: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className="bg-card rounded-2xl border border-red-200 p-6 shadow-lg dark:border-red-800">
      <h2 className="mb-4 text-lg font-bold text-red-600 dark:text-red-300">{label}</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        This will permanently delete <span className="font-semibold">{name}</span>.
      </p>
      <form action={action}>
        <Input type="hidden" name="id" value={id} />
        <Button
          type="submit"
          className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          {label}
        </Button>
      </form>
    </section>
  );
}
