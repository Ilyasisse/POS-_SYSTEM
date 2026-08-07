"use client";

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
import { updateSupplier } from "./actions";

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

type SupplierEditDialogProps = { supplier: Supplier };

const fieldClass =
  "h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500";

export function SupplierEditDialog({ supplier }: SupplierEditDialogProps) {
  const fieldId = (field: string) => `supplier-${supplier.id}-${field}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {supplier.name}</DialogTitle>
          <DialogDescription>
            Update this supplier&apos;s contact details and availability.
          </DialogDescription>
        </DialogHeader>
        <form action={updateSupplier} className="grid gap-4">
          <Input type="hidden" name="id" value={supplier.id} />
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className="grid gap-1 text-sm font-medium"
              htmlFor={fieldId("name")}
            >
              Supplier name
              <Input
                id={fieldId("name")}
                name="name"
                required
                defaultValue={supplier.name}
                className={fieldClass}
              />
            </label>
            <label
              className="grid gap-1 text-sm font-medium"
              htmlFor={fieldId("slug")}
            >
              Slug
              <Input
                id={fieldId("slug")}
                name="slug"
                defaultValue={supplier.slug}
                className={fieldClass}
              />
            </label>
            <label
              className="grid gap-1 text-sm font-medium"
              htmlFor={fieldId("contact-name")}
            >
              Contact name
              <Input
                id={fieldId("contact-name")}
                name="contactName"
                defaultValue={supplier.contactName ?? ""}
                className={fieldClass}
              />
            </label>
            <label
              className="grid gap-1 text-sm font-medium"
              htmlFor={fieldId("phone")}
            >
              Phone
              <Input
                id={fieldId("phone")}
                name="phone"
                defaultValue={supplier.phone ?? ""}
                className={fieldClass}
              />
            </label>
            <label
              className="grid gap-1 text-sm font-medium"
              htmlFor={fieldId("email")}
            >
              Business email
              <Input
                id={fieldId("email")}
                type="email"
                name="email"
                defaultValue={supplier.email ?? ""}
                className={fieldClass}
              />
            </label>
            <label
              className="grid gap-1 text-sm font-medium"
              htmlFor={fieldId("notes")}
            >
              Notes
              <Input
                id={fieldId("notes")}
                name="notes"
                defaultValue={supplier.notes ?? ""}
                className={fieldClass}
              />
            </label>
          </div>
          <Input type="hidden" name="isActive" value="false" />
          <label
            className="flex items-center gap-2 text-sm font-medium text-slate-700"
            htmlFor={fieldId("active")}
          >
            <Input
              id={fieldId("active")}
              type="checkbox"
              name="isActive"
              value="true"
              className="h-4 w-4 shrink-0"
              defaultChecked={supplier.isActive}
            />
            Active
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
