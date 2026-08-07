"use client";

import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createInvoiceForCompletedPurchaseOrderAction,
  updateSupplierPurchaseOrderStatus,
} from "../actions";

function confirmStatus(event: FormEvent<HTMLFormElement>, message: string) {
  if (!window.confirm(message)) event.preventDefault();
}

export default function PurchaseOrderStatusActions({
  orderId,
  mode = "open",
}: {
  orderId: string;
  mode?: "open" | "recovery";
}) {
  if (mode === "recovery") {
    return (
      <form
        className="mt-4"
        action={createInvoiceForCompletedPurchaseOrderAction}
        onSubmit={(event) =>
          confirmStatus(
            event,
            "Create an editable invoice from this completed purchase order?",
          )
        }
      >
        <Input type="hidden" name="id" value={orderId} />
        <Button type="submit">Create invoice</Button>
      </form>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <form
        action={updateSupplierPurchaseOrderStatus}
        onSubmit={(event) =>
          confirmStatus(
            event,
            "Mark this purchase order completed and create an editable invoice?",
          )
        }
      >
        <Input type="hidden" name="id" value={orderId} />
        <Input type="hidden" name="status" value="COMPLETED" />
        <Button type="submit">Mark completed &amp; create invoice</Button>
      </form>
      <form
        action={updateSupplierPurchaseOrderStatus}
        onSubmit={(event) =>
          confirmStatus(
            event,
            "Cancel this purchase order? This does not change inventory or bills.",
          )
        }
      >
        <Input type="hidden" name="id" value={orderId} />
        <Input type="hidden" name="status" value="CANCELLED" />
        <Button type="submit" variant="destructive">
          Cancel order
        </Button>
      </form>
    </div>
  );
}
