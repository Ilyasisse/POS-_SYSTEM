"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { SupplyEntryFields } from "./SupplyEntryForm";
import type { SupplyCatalogOption } from "./SupplyEntryForm";
import { deleteSupplyPurchase, updateSupplyPurchase } from "./actions";

type SupplyRowActionsProps = {
  id: string;
  itemName: string;
  quantity: string;
  unitPrice: string;
  purchaseDate: string;
  maxDate: string;
  catalogItemId: string | null;
  catalogItems: SupplyCatalogOption[];
};

export default function SupplyRowActions({
  id,
  itemName,
  quantity,
  unitPrice,
  purchaseDate,
  maxDate,
  catalogItemId,
  catalogItems,
}: SupplyRowActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {catalogItemId ? <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${itemName}`}>
            <Pencil className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Supply purchase</DialogTitle>
            <DialogDescription>
              Correct the item, quantity, price, or purchase date.
            </DialogDescription>
          </DialogHeader>
          <form action={updateSupplyPurchase} className="grid gap-4">
            <Input type="hidden" name="id" value={id} />
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor={`edit-${id}-date`}>
                Purchase date
              </label>
              <Input
                id={`edit-${id}-date`}
                type="date"
                name="purchaseDate"
                defaultValue={purchaseDate}
                max={maxDate}
                required
              />
            </div>
            <SupplyEntryFields
              prefix={`edit-${id}`}
              catalogItems={catalogItems}
              catalogItemId={catalogItemId}
              quantity={quantity}
              unitPrice={unitPrice}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog> : null}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${itemName}`}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {itemName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the purchase from the {purchaseDate} daily total.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <form action={deleteSupplyPurchase}>
              <Input type="hidden" name="id" value={id} />
              <Input type="hidden" name="returnDate" value={purchaseDate} />
              <AlertDialogAction type="submit" variant="destructive">
                Delete purchase
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
