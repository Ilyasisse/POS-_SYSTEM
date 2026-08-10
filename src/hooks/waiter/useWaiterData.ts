"use client";

import { useSyncExternalStore } from "react";
import type { Category, Product, StaffSummary } from "@/lib/types";

type WaiterDataSnapshot = {
  products: Product[];
  productsAll: Product[];
  categories: Category[];
  baristas: StaffSummary[];
  paymentMethods: string[];
  loading: boolean;
};

const paymentMethods = ["GOLIS", "MYCASH", "Dahabshiil", "OTHER"];
const initialSnapshot: WaiterDataSnapshot = {
  products: [],
  productsAll: [],
  categories: [],
  baristas: [],
  paymentMethods,
  loading: true,
};

let waiterDataSnapshot = initialSnapshot;
let waiterDataRequest: Promise<void> | null = null;
const waiterDataListeners = new Set<() => void>();

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

function publishWaiterData(snapshot: WaiterDataSnapshot) {
  waiterDataSnapshot = snapshot;
  waiterDataListeners.forEach((listener) => listener());
}

async function loadWaiterData() {
  try {
    const [productsResult, categoriesResult, baristasResult] =
      await Promise.allSettled([
        fetchJson<Product[]>("/api/GET/Product/all"),
        fetchJson<Category[]>("/api/GET/Category"),
        fetchJson<StaffSummary[]>("/api/users/baristas"),
      ]);

    if (productsResult.status !== "fulfilled") {
      throw productsResult.reason;
    }

    const productsAll = Array.isArray(productsResult.value)
      ? productsResult.value
      : [];
    const categories =
      categoriesResult.status === "fulfilled" &&
      Array.isArray(categoriesResult.value)
        ? categoriesResult.value
        : [];
    const baristas =
      baristasResult.status === "fulfilled" && Array.isArray(baristasResult.value)
        ? baristasResult.value
        : [];

    if (categoriesResult.status === "rejected") {
      console.error(
        "Failed to fetch categories:\n" + getErrorMessage(categoriesResult.reason),
      );
    }
    if (baristasResult.status === "rejected") {
      console.error(
        "Failed to fetch baristas:\n" + getErrorMessage(baristasResult.reason),
      );
    }

    publishWaiterData({
      products: productsAll.filter((product) => product.isPopular),
      productsAll,
      categories,
      baristas,
      paymentMethods,
      loading: false,
    });
  } catch (error) {
    console.error("Failed to fetch waiter data:\n" + getErrorMessage(error));
    publishWaiterData({ ...initialSnapshot, loading: false });
  }
}

function subscribeToWaiterData(listener: () => void) {
  const isFirstSubscriber = waiterDataListeners.size === 0;
  waiterDataListeners.add(listener);
  if (isFirstSubscriber && !waiterDataRequest) {
    publishWaiterData({ ...waiterDataSnapshot, loading: true });
    waiterDataRequest = loadWaiterData().finally(() => {
      waiterDataRequest = null;
    });
  }

  return () => waiterDataListeners.delete(listener);
}

function getWaiterDataSnapshot() {
  return waiterDataSnapshot;
}

function getWaiterDataServerSnapshot() {
  return initialSnapshot;
}

export function useWaiterData() {
  return useSyncExternalStore(
    subscribeToWaiterData,
    getWaiterDataSnapshot,
    getWaiterDataServerSnapshot,
  );
}
