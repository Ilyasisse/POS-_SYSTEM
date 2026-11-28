import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function InventoryDateSelector({
  date,
  today,
  filters = {},
}: {
  date: string;
  today: string;
  filters?: Record<string, string>;
}) {
  return (
    <form className="bg-card grid gap-3 rounded-2xl border p-4 sm:flex sm:items-end">
      {Object.entries(filters).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="grid gap-1.5 text-sm font-medium">
        Inventory date
        <Input name="date" type="date" defaultValue={date} max={today} required />
      </label>
      <Button type="submit" variant="outline">
        Use date
      </Button>
      <p className="text-muted-foreground text-xs">
        Restocks and withdrawals use this date. Stock shown is the current balance.
      </p>
    </form>
  );
}
