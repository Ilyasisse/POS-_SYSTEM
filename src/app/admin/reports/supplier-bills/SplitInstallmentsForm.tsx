"use client";

import { type FormEvent, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { splitSupplierBillIntoInstallmentsAction } from "./actions";

type Row = { key: string; dueDate: string; amount: string };

export default function SplitInstallmentsForm({
  billId,
  dueDate,
  remaining,
}: {
  billId: string;
  dueDate: string;
  remaining: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([
    { key: "initial-installment", dueDate, amount: remaining.toFixed(2) },
  ]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const scheduled = rows.reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await splitSupplierBillIntoInstallmentsAction(data);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not split this invoice.",
        );
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="grid min-w-64 gap-2 rounded-lg border bg-slate-50 p-2"
    >
      <Input type="hidden" name="billId" value={billId} />
      <strong className="text-xs">
        Split remaining balance into installments
      </strong>
      {rows.map((row, index) => (
        <div key={row.key} className="flex gap-1">
          <Input
            required
            name="installmentDueDate"
            type="date"
            value={row.dueDate}
            disabled={pending}
            onChange={(event) =>
              setRows((current) =>
                current.map((item, rowIndex) =>
                  rowIndex === index
                    ? { ...item, dueDate: event.target.value }
                    : item,
                ),
              )
            }
          />
          <Input
            required
            name="installmentAmount"
            type="number"
            min="0.01"
            step="0.01"
            value={row.amount}
            disabled={pending}
            onChange={(event) =>
              setRows((current) =>
                current.map((item, rowIndex) =>
                  rowIndex === index
                    ? { ...item, amount: event.target.value }
                    : item,
                ),
              )
            }
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={pending || rows.length === 1}
            onClick={() =>
              setRows((current) =>
                current.filter((_, rowIndex) => rowIndex !== index),
              )
            }
            aria-label={`Remove installment ${index + 1}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span
          className={
            Math.abs(scheduled - remaining) < 0.005
              ? "text-emerald-700"
              : "text-red-700"
          }
        >
          Scheduled ${scheduled.toFixed(2)} / ${remaining.toFixed(2)}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                key: `installment-${Date.now()}-${current.length}`,
                dueDate: current.at(-1)?.dueDate || dueDate,
                amount: "0.00",
              },
            ])
          }
        >
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {" "}
        {pending ? "Saving..." : "Save installment plan"}{" "}
      </Button>
      {message ? (
        <p role="status" className="text-xs font-semibold text-red-700">
          {message}
        </p>
      ) : null}
    </form>
  );
}
