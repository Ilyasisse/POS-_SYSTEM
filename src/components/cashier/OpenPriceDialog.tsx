"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { resolveProductBasePrice } from "@/lib/catalog/open-price";

type OpenPriceDialogProps = {
  product: Product | null;
  onClose: () => void;
  onConfirm: (product: Product) => void;
};

export default function OpenPriceDialog({
  product,
  onClose,
  onConfirm,
}: OpenPriceDialogProps) {
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");

  function close() {
    setPrice("");
    setError("");
    onClose();
  }

  function confirm() {
    if (!product) return;
    const result = resolveProductBasePrice({
      isOpenPrice: true,
      catalogPrice: Number(product.price),
      submittedPrice: price,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPrice("");
    setError("");
    onConfirm({
      ...product,
      price: result.basePrice,
      openPriceEntered: true,
    });
  }

  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md rounded-[2rem] p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle>Set price for {product?.name ?? "item"}</DialogTitle>
          <DialogDescription>
            Enter the base price for this order. Modifiers are added afterward.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label htmlFor="cashier-open-price" className="block">
            <span className="mb-2 block text-sm font-semibold">Price</span>
            <Input
              id="cashier-open-price"
              type="number"
              min="0.01"
              max="10000"
              step="0.01"
              inputMode="decimal"
              value={price}
              onChange={(event) => {
                setPrice(event.target.value);
                setError("");
              }}
              placeholder="0.00"
              autoFocus
            />
          </label>
          {error ? (
            <p className="text-sm font-semibold text-red-700">{error}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="button" onClick={confirm}>
              Use this price
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
