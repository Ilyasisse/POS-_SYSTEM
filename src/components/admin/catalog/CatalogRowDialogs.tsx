"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  availabilitySchema,
  catalogFormValues,
  fieldErrors,
  saleAvailable,
  type CatalogKind,
  type CatalogRecord,
} from "@/lib/catalog/catalog";
import {
  changeCatalogAvailability,
  deleteCatalogItem,
} from "@/app/admin/(catalog)/actions";

export function CatalogDeleteDialog({
  kind,
  row,
  onClose,
  onDeleted,
}: {
  kind: CatalogKind;
  row: CatalogRecord;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  function remove() {
    const form = new FormData();
    form.set("id", row.id);
    form.set("updatedAt", row.updatedAt);
    form.set("confirmed", "yes");
    startTransition(async () => {
      try {
        const result = await deleteCatalogItem(kind, form);
        toast({
          tone: result.ok ? "success" : "error",
          description: result.message,
          ...(!result.ok
            ? { action: { label: "Review item", onClick: onClose } }
            : {}),
        });
        if (result.ok) onDeleted();
        else setMessage(result.message);
      } catch {
        const error =
          "Could not delete this item. Check your connection and try again.";
        setMessage(error);
        toast({ tone: "error", description: error });
      }
    });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!pending}
        className="sm:max-w-md"
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogTitle className="pr-7 text-lg">Delete {row.name}?</DialogTitle>
        <DialogDescription>
          This permanently deletes an unused item. Products or modifiers
          referenced by orders or inventory are deactivated instead. Categories
          with products and groups with linked options cannot be deleted.
        </DialogDescription>
        <p className="rounded-lg bg-muted/50 p-3 text-sm">
          Existing order and inventory records will be preserved. You can cancel
          and deactivate the item in its editor.
        </p>
        {message && (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            disabled={pending}
            onClick={remove}
          >
            {pending ? "Deleting…" : "Confirm deletion"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CatalogAvailabilityDialog({
  row,
  onClose,
}: {
  row: CatalogRecord;
  onClose: () => void;
}) {
  const resume = !saleAvailable(row);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const dirty = useRef(false);
  const { toast } = useToast();
  const router = useRouter();
  useEffect(() => {
    function unload(event: BeforeUnloadEvent) {
      if (dirty.current || pending) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [pending]);
  function close() {
    if (
      !pending &&
      (!dirty.current ||
        window.confirm("Discard your unsaved availability changes?"))
    ) {
      dirty.current = false;
      onClose();
    }
  }
  function changed(event: React.FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    dirty.current =
      !resume &&
      (form.get("availabilityReason") !== "" ||
        form.get("durationMinutes") !== "180");
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const parsed = availabilitySchema.safeParse(catalogFormValues(form));
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setMessage("Check the highlighted fields.");
      toast({ tone: "error", description: "Check the highlighted fields." });
      const firstField = parsed.error.issues[0]?.path[0];
      requestAnimationFrame(() => {
        document
          .getElementById(
            firstField === "durationMinutes" ? "sale-duration" : "sale-reason",
          )
          ?.focus();
      });
      return;
    }
    setMessage("");
    setErrors({});
    startTransition(async () => {
      try {
        const result = await changeCatalogAvailability(form);
        toast({
          tone: result.ok ? "success" : "error",
          description: result.message,
        });
        if (result.ok) {
          dirty.current = false;
          onClose();
          router.refresh();
        } else {
          setMessage(result.message);
          setErrors(result.errors ?? {});
        }
      } catch {
        const error =
          "Could not change availability. Check your connection and try again.";
        setMessage(error);
        toast({ tone: "error", description: error });
      }
    });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        showCloseButton={!pending}
        className="sm:max-w-md"
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          close();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <DialogTitle className="pr-7 text-lg">
          {resume ? "Resume sales" : "Mark sold out"}: {row.name}
        </DialogTitle>
        <DialogDescription>
          {resume
            ? "Resume ordering without changing stock quantities. Inactive items and products in inactive categories remain hidden."
            : "Pause ordering now. Choose a timed pause or resume sales manually later."}
        </DialogDescription>
        <form
          noValidate
          onSubmit={submit}
          onChange={changed}
          className="space-y-4"
        >
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="updatedAt" value={row.updatedAt} />
          <input
            type="hidden"
            name="availableForSale"
            value={resume ? "on" : "off"}
          />
          {resume ? (
            <>
              <input type="hidden" name="availabilityReason" value="" />
              <input type="hidden" name="durationMinutes" value="" />
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label
                  htmlFor="sale-reason"
                  className="block text-sm font-semibold"
                >
                  Reason
                </label>
                <Textarea
                  id="sale-reason"
                  name="availabilityReason"
                  minLength={3}
                  maxLength={200}
                  placeholder="Example: delivery is delayed"
                  aria-invalid={!!errors.availabilityReason}
                  aria-describedby={
                    errors.availabilityReason ? "sale-reason-error" : undefined
                  }
                  disabled={pending}
                />
                {errors.availabilityReason && (
                  <p
                    id="sale-reason-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors.availabilityReason}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="sale-duration"
                  className="block text-sm font-semibold"
                >
                  Resume sales
                </label>
                <NativeSelect
                  id="sale-duration"
                  name="durationMinutes"
                  className="w-full [&_select]:min-h-11"
                  defaultValue="180"
                  disabled={pending}
                  aria-invalid={!!errors.durationMinutes}
                  aria-describedby={
                    errors.durationMinutes ? "sale-duration-error" : undefined
                  }
                >
                  <option value="60">After 1 hour</option>
                  <option value="180">After 3 hours</option>
                  <option value="720">After 12 hours</option>
                  <option value="1440">After 24 hours</option>
                  <option value="">Manually</option>
                </NativeSelect>
                {errors.durationMinutes && (
                  <p
                    id="sale-duration-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors.durationMinutes}
                  </p>
                )}
              </div>
            </>
          )}
          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={resume ? "default" : "destructive"}
              className="min-h-11"
              disabled={pending}
            >
              {pending ? "Saving…" : resume ? "Resume sales" : "Mark sold out"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
