"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function PriceChangeFields({
  initialPrice,
}: {
  initialPrice: number;
}) {
  const [price, setPrice] = useState(String(initialPrice));
  const priceChanged = Number(price) !== initialPrice;

  return (
    <>
      <div>
        <label
          htmlFor="product-price"
          className="mb-1 block text-sm font-medium"
        >
          Price
        </label>
        <Input
          id="product-price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          required
        />
      </div>
      <div>
        <label
          htmlFor="price-change-reason"
          className="mb-1 block text-sm font-medium"
        >
          Reason for price change
        </label>
        <Input
          id="price-change-reason"
          name="priceChangeReason"
          type="text"
          minLength={priceChanged ? 3 : undefined}
          maxLength={300}
          required={priceChanged}
          placeholder={
            priceChanged
              ? "Why is the price changing?"
              : "Required only when changing the price"
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <p className="mt-1 text-xs text-slate-500">
          {priceChanged
            ? "Enter at least 3 characters to explain this price change."
            : "No reason is needed when the price stays the same."}
        </p>
      </div>
    </>
  );
}
