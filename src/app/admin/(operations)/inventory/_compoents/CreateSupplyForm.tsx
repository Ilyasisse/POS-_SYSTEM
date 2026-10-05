import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createSupply } from '../actions';
import { Button } from '@/components/ui/button';


export default function CreateSupplyForm() {
  return (
    <Card className="p-4">
      <form
        action={createSupply}
        className="grid gap-3 lg:grid-cols-[1fr_0.5fr_0.4fr_0.4fr_auto]"
      >
        <Input
          aria-label="Supply name"
          name="name"
          type="text"
          placeholder="Item name"
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          required
        />
        <Input
          aria-label="Supply unit"
          name="unit"
          type="text"
          placeholder="Unit"
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        />
        <Input
          aria-label="Initial stock quantity"
          name="stockQty"
          type="number"
          min="0"
          step="0.001"
          placeholder="Stock"
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        />
        <Input
          aria-label="Low stock threshold"
          name="lowStockThreshold"
          type="number"
          min="0"
          step="0.001"
          placeholder="Low"
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        />
        <Button type="submit">Add Supply</Button>
      </form>
    </Card>
  );
}
