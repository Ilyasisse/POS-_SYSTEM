"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus, SalesAdjustmentType } from "@prisma/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type OrderLine = {
  id: string;
  label: string;
  lineTotal: string;
};

const labels: Record<SalesAdjustmentType, string> = {
  DISCOUNT: "Discount",
  VOID: "Void complete order",
  COMPLIMENTARY: "Complimentary item/order",
  STAFF_MEAL: "Staff meal",
  REFUND: "Refund",
};

export default function OrderAdjustmentForm({
  orderId,
  orderStatus,
  orderTotal,
  lines,
  canApproveOperational,
  canApproveFinancial,
}: {
  orderId: string;
  orderStatus: OrderStatus;
  orderTotal: string;
  lines: OrderLine[];
  canApproveOperational: boolean;
  canApproveFinancial: boolean;
}) {
  const router = useRouter();
  const availableTypes = useMemo(() => {
    const types: SalesAdjustmentType[] = [];
    if (orderStatus === "OPEN" && canApproveOperational) {
      types.push("DISCOUNT", "COMPLIMENTARY", "STAFF_MEAL", "VOID");
    }
    if (orderStatus === "PAID" && canApproveFinancial) types.push("REFUND");
    return types;
  }, [canApproveFinancial, canApproveOperational, orderStatus]);
  const [type, setType] = useState<SalesAdjustmentType | "">(
    availableTypes[0] ?? "",
  );
  const [orderItemId, setOrderItemId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<
    { tone: "success" | "error"; text: string } | undefined
  >();
  const [pending, startTransition] = useTransition();

  const isVoid = type === "VOID";
  const selectedLine = lines.find((line) => line.id === orderItemId);

  function chooseLine(nextId: string) {
    setOrderItemId(nextId);
    const line = lines.find((item) => item.id === nextId);
    if (line && type !== "VOID") setAmount(line.lineTotal);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type) return;
    setMessage(undefined);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}/adjustments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            orderItemId: isVoid ? null : orderItemId || null,
            amount: isVoid ? orderTotal : amount,
            reason,
          }),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error || "Adjustment failed.");
        setMessage({ tone: "success", text: `${labels[type]} recorded successfully.` });
        setAmount("");
        setOrderItemId("");
        setReason("");
        router.refresh();
      } catch (error) {
        setMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "Adjustment failed.",
        });
      }
    });
  }

  if (availableTypes.length === 0) {
    return (
      <Alert>
        <AlertTitle>No available adjustments</AlertTitle>
        <AlertDescription>
          Open orders require operational approval. Paid orders require financial
          approval for refunds. Cancelled orders cannot be adjusted.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="adjustment-type">Adjustment</Label>
          <NativeSelect
            id="adjustment-type"
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as SalesAdjustmentType;
              setType(nextType);
              if (nextType === "VOID") {
                setOrderItemId("");
                setAmount(orderTotal);
              }
            }}
          >
            {availableTypes.map((option) => (
              <option key={option} value={option}>{labels[option]}</option>
            ))}
          </NativeSelect>
        </div>
        {!isVoid ? (
          <div className="space-y-2">
            <Label htmlFor="adjustment-line">Apply to</Label>
            <NativeSelect
              id="adjustment-line"
              value={orderItemId}
              onChange={(event) => chooseLine(event.target.value)}
            >
              <option value="">Complete order</option>
              {lines.map((line) => (
                <option key={line.id} value={line.id}>{line.label}</option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="adjustment-amount">Amount</Label>
        <Input
          id="adjustment-amount"
          type="number"
          min="0.01"
          max={selectedLine?.lineTotal ?? orderTotal}
          step="0.01"
          value={isVoid ? orderTotal : amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={isVoid}
          required
        />
        <p className="text-xs text-muted-foreground">
          Maximum: ${selectedLine?.lineTotal ?? orderTotal}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="adjustment-reason">Reason</Label>
        <Textarea
          id="adjustment-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={3}
          maxLength={500}
          placeholder="Explain why this adjustment is necessary"
          required
        />
      </div>

      {isVoid || type === "REFUND" ? (
        <Alert variant="destructive">
          <AlertTitle>{isVoid ? "This cancels the complete order" : "Financial action"}</AlertTitle>
          <AlertDescription>
            {isVoid
              ? "The order will close as cancelled and cannot receive payment."
              : "Confirm the amount and reason before recording this refund."}
          </AlertDescription>
        </Alert>
      ) : null}

      {message ? (
        <Alert variant={message.tone === "error" ? "destructive" : "default"}>
          <AlertTitle>{message.tone === "error" ? "Could not save" : "Saved"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" variant={isVoid || type === "REFUND" ? "destructive" : "default"} disabled={pending}>
        {pending ? "Saving..." : `Record ${type ? labels[type].toLowerCase() : "adjustment"}`}
      </Button>
    </form>
  );
}
