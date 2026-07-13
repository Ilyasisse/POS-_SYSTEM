"use client";

import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SettlementSubmitButton({
  hasExistingSettlement,
}: {
  hasExistingSettlement: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Save aria-hidden="true" />
      {pending
        ? "Saving..."
        : hasExistingSettlement
          ? "Update"
          : "Close day"}
    </Button>
  );
}
