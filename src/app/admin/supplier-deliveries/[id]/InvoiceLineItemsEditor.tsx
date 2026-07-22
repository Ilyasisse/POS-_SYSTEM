"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table } from "@/components/ui/table";

export type Target = { value: string; label: string };
export type ReviewRow = {
  id: string;
  description: string;
  target: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
};

export default function InvoiceLineItemsEditor({
  rows,
  targets,
  onRemove,
}: {
  rows: ReviewRow[];
  targets: Target[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <Table className="min-w-[920px] w-full text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            {[
              "Description",
              "Inventory match",
              "Quantity",
              "Unit price",
              "Line total",
              "",
            ].map((label, index) => (
              <th
                key={`${label}-${index}`}
                className="px-3 py-3 text-xs font-black text-slate-600"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 align-top">
              <td className="px-3 py-3">
                <Input type="hidden" name="rowId" value={row.id} />
                <Input
                  required
                  maxLength={300}
                  name={`description-${row.id}`}
                  defaultValue={row.description}
                  className="h-10 min-w-56 rounded-lg border border-slate-200 px-2"
                />
              </td>
              <td className="px-3 py-3">
                <NativeSelect
                  required
                  name={`target-${row.id}`}
                  defaultValue={row.target}
                  className="h-10 min-w-56 rounded-lg border border-slate-200 px-2"
                >
                  <option value="">Choose item...</option>
                  {targets.map((target) => (
                    <option key={target.value} value={target.value}>
                      {target.label}
                    </option>
                  ))}
                </NativeSelect>
              </td>
              <td className="px-3 py-3">
                <Input
                  required
                  min={1}
                  step={1}
                  type="number"
                  name={`quantity-${row.id}`}
                  defaultValue={row.quantity}
                  className="h-10 w-24 rounded-lg border border-slate-200 px-2"
                />
              </td>
              <td className="px-3 py-3">
                <Input
                  min={0}
                  step="0.01"
                  type="number"
                  name={`unitPrice-${row.id}`}
                  defaultValue={row.unitPrice}
                  className="h-10 w-28 rounded-lg border border-slate-200 px-2"
                />
              </td>
              <td className="px-3 py-3">
                <Input
                  required
                  min={0}
                  step="0.01"
                  type="number"
                  name={`totalPrice-${row.id}`}
                  defaultValue={row.totalPrice}
                  className="h-10 w-28 rounded-lg border border-slate-200 px-2"
                />
              </td>
              <td className="px-3 py-3">
                <Button
                  type="button"
                  onClick={() => onRemove(row.id)}
                  disabled={rows.length === 1}
                  className="h-10 rounded-lg border border-red-200 px-3 font-bold text-red-700 disabled:opacity-40"
                >
                  Remove
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
