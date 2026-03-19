"use client";

import { useEffect, useState } from "react";
import type { Category, Product, StaffSummary } from "@/lib/types";

type FetchFailure = {
  endpoint: string;
  status: number;
  body: string;
};

function isFetchFailure(value: unknown): value is FetchFailure {
  if (!value || typeof value !== "object") return false;

  const maybe = value as Record<string, unknown>;

  return (
    typeof maybe.endpoint === "string" &&
    typeof maybe.status === "number" &&
    typeof maybe.body === "string"
  );
}

function getErrorMessage(error: unknown) {
  if (isFetchFailure(error)) {
    return `Request failed: ${error.endpoint} [${error.status}] ${error.body || "No response body"}`;
  }

  if (error instanceof Error) {
    return `${error.message}\n${error.stack ?? ""}`;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

async function fetchJson<T>(endpoint: string): Promise<T> {
  const response = await fetch(endpoint, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  if (!response.ok) {
    throw {
      endpoint,
      status: response.status,
      body: rawText,
    } satisfies FetchFailure;
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      `${endpoint} returned non-JSON response. Content-Type: ${
        contentType || "unknown"
      }. Body: ${rawText}`,
    );
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(`${endpoint} returned invalid JSON. Body: ${rawText}`);
  }
}

export function useWaiterData() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsAll, setProductsAll] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [baristas, setBaristas] = useState<StaffSummary[]>([]);
  const [paymentMethods] = useState<string[]>([
    "GOLIS",
    "MYCASH",
    "Dahabshiil",
    "OTHER",
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);

        const [productsResult, categoriesResult, baristasResult] =
          await Promise.allSettled([
            fetchJson<Product[]>("/api/GET/Product/all"),
            fetchJson<Category[]>("/api/GET/Category"),
            fetchJson<StaffSummary[]>("/api/users/baristas"),
          ]);

        if (!isMounted) return;

        if (productsResult.status !== "fulfilled") {
          throw productsResult.reason;
        }

        const allProducts = Array.isArray(productsResult.value)
          ? productsResult.value
          : [];

        setProductsAll(allProducts);
        setProducts(allProducts.filter((product) => product.isPopular));

        if (categoriesResult.status === "fulfilled") {
          setCategories(
            Array.isArray(categoriesResult.value) ? categoriesResult.value : [],
          );
        } else {
          console.error(
            "Failed to fetch categories:\n" +
              getErrorMessage(categoriesResult.reason),
          );
          setCategories([]);
        }

        if (baristasResult.status === "fulfilled") {
          setBaristas(
            Array.isArray(baristasResult.value) ? baristasResult.value : [],
          );
        } else {
          console.error(
            "Failed to fetch baristas:\n" + getErrorMessage(baristasResult.reason),
          );
          setBaristas([]);
        }
      } catch (error) {
        console.error("Failed to fetch waiter data:\n" + getErrorMessage(error));
        setProducts([]);
        setProductsAll([]);
        setCategories([]);
        setBaristas([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    products,
    productsAll,
    categories,
    baristas,
    paymentMethods,
    loading,
  };
}
