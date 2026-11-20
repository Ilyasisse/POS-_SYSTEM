"use client";

import { useState } from "react";
import { useClientResource } from "@/hooks/useClientResource";
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

async function loadCustomerOrderData(signal: AbortSignal): Promise<CustomerOrderData> {
  const [productsAll, categories, baristas] = await Promise.all([
    loadJson<Product[]>("/api/GET/Product/all", signal),
    loadJson<Category[]>("/api/GET/Category", signal),
    loadJson<StaffSummary[]>("/api/public/baristas", signal),
  ]);
  return { productsAll, categories, baristas, loading: false, error: null };
}

export function useCustomerOrderData(onReady: (data: CustomerOrderData) => void) {
  const [data, setData] = useState(initialData);
  useClientResource({
    load: loadCustomerOrderData,
    onData(data) {
      setData(data);
      onReady(data);
    },
    onError(error) {
      setData({
        ...initialData,
        loading: false,
        error: error instanceof Error ? error.message : "The ordering menu is unavailable.",
      });
    },
  });
  return data;
}
