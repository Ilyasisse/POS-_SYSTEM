"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createSupplier, updateSupplier } from "./actions";

type Supplier = {
  id: string;
  name: string;
  slug: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
};

type SupplierEditDialogProps = { supplier?: Supplier };

const fieldClass =
  "h-10 rounded-lg border border-border px-3 text-sm outline-none focus:border-blue-500 dark:focus:border-blue-800";

export function SupplierEditDialog({ supplier }: SupplierEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const fieldId = (field: string) => `supplier-${supplier?.id ?? "new"}-${field}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {supplier ? "Edit" : "+ Add supplier"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplier ? `Edit ${supplier.name}` : "Add supplier"}</DialogTitle>
          <DialogDescription>
            Update this supplier&apos;s contact details and availability.
          </DialogDescription>
        </DialogHeader>
        <form
          action={async (data) => {
            setPending(true);
            setError("");
            try {
              await (supplier ? updateSupplier : createSupplier)(data);
              setOpen(false);
              toast({ description: "Supplier account details refreshed.", tone: "success", title: supplier ? "Supplier updated" : "Supplier created" });
            } catch {
              setError("Unable to save. Check the name and enter a unique, valid slug.");
              toast({ description: "Supplier account details refreshed.", tone: "error", title: "Supplier not saved" });
            } finally {
              setPending(false);
            }
          }}
          className="grid gap-4"
        >
          <Input type="hidden" name="id" value={supplier?.id} />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium" htmlFor={fieldId("name")}>
              Supplier name
              <Input
                id={fieldId("name")}
                name="name"
                required
                defaultValue={supplier?.name}
                className={fieldClass}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium" htmlFor={fieldId("slug")}>
              Slug
              <Input
                id={fieldId("slug")}
                name="slug"
                defaultValue={supplier?.slug}
                className={fieldClass}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium" htmlFor={fieldId("contact-name")}>
              Contact name
              <Input
                id={fieldId("contact-name")}
                name="contactName"
                defaultValue={supplier?.contactName ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium" htmlFor={fieldId("phone")}>
              Phone
              <Input
                id={fieldId("phone")}
                name="phone"
                defaultValue={supplier?.phone ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium" htmlFor={fieldId("email")}>
              Business email
              <Input
                id={fieldId("email")}
                type="email"
                name="email"
                defaultValue={supplier?.email ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium" htmlFor={fieldId("notes")}>
              Notes
              <Input
                id={fieldId("notes")}
                name="notes"
                defaultValue={supplier?.notes ?? ""}
                className={fieldClass}
              />
            </label>
          </div>
          <Input type="hidden" name="isActive" value="false" />
          <label
            className="text-foreground flex items-center gap-2 text-sm font-medium"
            htmlFor={fieldId("active")}
          >
            <Input
              id={fieldId("active")}
              type="checkbox"
              name="isActive"
              value="true"
              className="h-4 w-4 shrink-0"
              defaultChecked={supplier?.isActive ?? true}
            />
            Active
          </label>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {supplier ? "Save changes" : "Create supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
