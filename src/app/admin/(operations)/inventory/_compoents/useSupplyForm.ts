"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useToast } from "@/components/ui/toast";
import type { SupplyFormResult } from "../actions";

type FormError = Extract<SupplyFormResult, { ok: false }>;

export function useSupplyForm(
  action: (data: FormData) => Promise<SupplyFormResult>,
  successMessage: string,
  resetOnSuccess = false,
  onPendingChange?: (pending: boolean) => void,
  onSuccess?: () => void,
) {
  const { toast } = useToast();
  const errorId = useId();
  const inFlight = useRef(false);
  const [error, setError] = useState<FormError>();
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    setError(undefined);
    inFlight.current = true;
    onPendingChange?.(true);
    startTransition(async () => {
      try {
        const result = await action(data);
        if (!result.ok) {
          if (result.field) setError(result);
          else toast({ tone: "error", description: result.error });
          return;
        }

        if (resetOnSuccess) form.reset();
        onSuccess?.();
        toast({
          tone: "success",
          description:
            result.email === "sent" ? successMessage + " Low-stock email sent." : successMessage,
        });
        if (result.email === "failed" || result.email === "skipped") {
          toast({
            tone: "warning",
            title: "Low-stock email unavailable",
            description: "Ask an admin to check the inventory email settings.",
          });
        }
      } catch {
        toast({
          tone: "error",
          description: "Could not confirm the change. Refresh and check inventory before retrying.",
        });
      } finally {
        inFlight.current = false;
        onPendingChange?.(false);
      }
    });
  }

  function fieldError(field: FormError["field"]) {
    return {
      "aria-invalid": error?.field === field ? true : undefined,
      "aria-describedby": error?.field === field ? errorId : undefined,
    };
  }

  return { submit, pending, error, errorId, fieldError };
}
