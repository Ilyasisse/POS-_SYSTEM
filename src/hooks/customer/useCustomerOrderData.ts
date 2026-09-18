"use client";

import { useEffect, useState } from "react";
import type { Category, Product, StaffSummary } from "@/lib/types";

type CustomerOrderData = {
  productsAll: Product[];
  categories: Category[];
  baristas: StaffSummary[];
  loading: boolean;
  error: string | null;
};

const initialData: CustomerOrderData = {
  productsAll: [],
  categories: [],
  baristas: [],
  loading: true,
  error: null,
};

async function loadJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok)
    throw new Error(
      "The ordering menu is unavailable. Please refresh and try again.",
    );
  return response.json() as Promise<T>;
}

export function useCustomerOrderData() {
  const [data, setData] = useState<CustomerOrderData>(initialData);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      loadJson<Product[]>("/api/GET/Product/all", controller.signal),
      loadJson<Category[]>("/api/GET/Category", controller.signal),
      loadJson<StaffSummary[]>("/api/public/baristas", controller.signal),
    ])
      .then(([productsAll, categories, baristas]) => {
        setData({
          productsAll,
          categories,
          baristas,
          loading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setData({
          ...initialData,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "The ordering menu is unavailable.",
        });
      });
    return () => controller.abort();
  }, []);

  return data;
}
