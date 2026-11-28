"use client";

import { useCustomerTranslations } from "@/components/customer/i18n/CustomerLanguageProvider";

import { useEffect, useState } from "react";
type Props = {
  orderType: "DINE_IN" | "TAKEOUT";
  tableId: string;
  onChange: (type: "DINE_IN" | "TAKEOUT", tableId: string) => void;
};
export default function CustomerFulfillmentSelect({ orderType, tableId, onChange }: Props) {
  const t = useCustomerTranslations();
  const [tables, setTables] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/customer/tables", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("tables unavailable");
        return response.json() as Promise<{
          tables: { id: string; name: string }[];
        }>;
      })
      .then((data) => setTables(data.tables))
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <fieldset className="mt-4 space-y-3">
      <legend className="text-sm font-semibold">{t("whereEat")}</legend>
      <label className="mr-4 inline-flex gap-2">
        <input
          type="radio"
          name="fulfillment"
          checked={orderType === "TAKEOUT"}
          onChange={() => onChange("TAKEOUT", "")}
        />
        {t("toGo")}
      </label>
      <label className="inline-flex gap-2">
        <input
          type="radio"
          name="fulfillment"
          checked={orderType === "DINE_IN"}
          onChange={() => onChange("DINE_IN", tableId)}
        />
        {t("dineIn")}
      </label>
      {orderType === "DINE_IN" ? (
        <div>
          <label htmlFor="customer-table" className="block text-sm">
            {t("tableRequired")}
          </label>
          <select
            id="customer-table"
            required
            value={tableId}
            onChange={(event) => onChange("DINE_IN", event.target.value)}
            className="bg-background mt-1 w-full rounded-lg border p-3"
          >
            <option value="">{t("selectTable")}</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.name}
              </option>
            ))}
          </select>
          {error ? (
            <p role="alert" className="text-sm text-rose-700">
              {t("tablesError")}
            </p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
