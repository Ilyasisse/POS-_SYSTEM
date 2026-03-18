"use client";

import { useEffect, useState } from "react";
import type { Category, Product } from "@/lib/types";

export function useWaiterData() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsAll, setProductsAll] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods] = useState<string[]>([
    "GOLIS",
    "MYCASH",
    "Dahabshiil",
    "OTHER",
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsIsActiveRes, productsAllRes, categoriesRes] =
          await Promise.all([
            fetch("/api/GET/Product"),
            fetch("/api/GET/Product/all"),
            fetch("/api/GET/Category"),
          ]);

        if (
          !productsIsActiveRes.ok ||
          !productsAllRes.ok ||
          !categoriesRes.ok
        ) {
          throw new Error("Failed to fetch waiter data");
        }

        const productsData: Product[] = await productsIsActiveRes.json();
        const productsDataAll: Product[] = await productsAllRes.json();
        const categoriesData: Category[] = await categoriesRes.json();

        setProducts(productsData);
        setProductsAll(productsDataAll);
        setCategories(categoriesData);
      } catch (error) {
        console.error("fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return {
    products,
    productsAll,
    categories,
    paymentMethods,
    loading,
  };
}