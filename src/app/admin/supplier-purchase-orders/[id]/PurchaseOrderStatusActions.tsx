"use client";

import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateSupplierPurchaseOrderStatus } from "../actions";

function confirmStatus(
  event: FormEvent<HTMLFormElement>,
  message: string,
) {
  if (!window.confirm(message)) event.preventDefault();
}

export default function PurchaseOrderStatusActions({
  orderId,
}: {
  orderId: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <form
        action={updateSupplierPurchaseOrderStatus}
        onSubmit={(event) =>
          confirmStatus(event, "Mark this purchase order completed?")
        }
      >
        <Input type="hidden" name="id" value={orderId} />
        <Input type="hidden" name="status" value="COMPLETED" />
        <Button type="submit">Mark completed</Button>
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
        <Button type="submit" variant="destructive">Cancel order</Button>
      </form>
    </div>
  );
}
