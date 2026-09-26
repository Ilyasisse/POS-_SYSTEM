"use client";

import { useCallback, useEffect, useState } from "react";
import type { Category, Product, StaffSummary } from "@/lib/types";
import {
  CUSTOMER_MENU_CACHE_KEY,
  parseCustomerMenuCache,
  serializeCustomerMenu,
} from "@/lib/customer/customer-menu-cache";

type CustomerOrderData = {
  productsAll: Product[];
  categories: Category[];
  baristas: StaffSummary[];
  loading: boolean;
  error: string | null;
  stale: boolean;
};

const initialData: CustomerOrderData = {
  productsAll: [],
  categories: [],
  baristas: [],
  loading: true,
  error: null,
  stale: false,
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
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    const offline = () =>
      setData((current) => ({ ...current, stale: true, baristas: [] }));
    window.addEventListener("offline", offline);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      loadJson<Product[]>("/api/GET/Product/all", controller.signal),
      loadJson<Category[]>("/api/GET/Category", controller.signal),
      loadJson<StaffSummary[]>("/api/public/baristas", controller.signal),
    ])
      .then(([productsAll, categories, baristas]) => {
        if (controller.signal.aborted) return;
        try {
          window.localStorage.setItem(
            CUSTOMER_MENU_CACHE_KEY,
            serializeCustomerMenu(productsAll, categories),
          );
        } catch {
          // Private browsing and full storage must not break live menu loading.
        }
        setData({
          productsAll,
          categories,
          baristas: navigator.onLine ? baristas : [],
          loading: false,
          error: null,
          stale: !navigator.onLine,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        let cached = null;
        try {
          cached = parseCustomerMenuCache(
            window.localStorage.getItem(CUSTOMER_MENU_CACHE_KEY),
          );
        } catch {
          // Local storage may be unavailable. Keep data already loaded in this tab.
        }
        setData((current) => {
          if (cached)
            return {
              ...cached,
              baristas: [],
              loading: false,
              error: null,
              stale: true,
            };
          if (current.productsAll.length)
            return {
              ...current,
              baristas: [],
              loading: false,
              error: null,
              stale: true,
            };
          return {
            ...initialData,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "The ordering menu is unavailable.",
          };
        });
      });
    return () => controller.abort();
  }, [attempt]);

  return { ...data, refresh };
}
