"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createCustomerTranslator,
  customerLocaleCookie,
  resolveCustomerLocale,
  type CustomerLocale,
  type CustomerTranslator,
} from "@/i18n/customer";

const english = createCustomerTranslator("en");
const CustomerLanguageContext = createContext<{
  locale: CustomerLocale;
  setLocale: (locale: CustomerLocale) => void;
  t: CustomerTranslator;
} | null>(null);

export function CustomerLanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: CustomerLocale;
  children?: ReactNode;
}) {
  const [locale, setCurrentLocale] = useState(initialLocale);
  const value = useMemo(
    () => ({
      locale,
      t: createCustomerTranslator(locale),
      setLocale: (nextLocale: CustomerLocale) => {
        const next = resolveCustomerLocale(nextLocale);
        setCurrentLocale(next);
        try {
          document.cookie = customerLocaleCookie(next, window.location.protocol === "https:");
        } catch {
          // The current page still works when browser privacy settings block cookies.
        }
      },
    }),
    [locale],
  );

  // Portaled dialogs also inherit the selected language. Restore staff pages on exit.
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [locale]);

  return (
    <CustomerLanguageContext.Provider value={value}>
      <div lang={locale}>{children}</div>
    </CustomerLanguageContext.Provider>
  );
}

// Shared cashier components continue to render English outside the customer layout.
export function useCustomerTranslations() {
  return useContext(CustomerLanguageContext)?.t ?? english;
}

export function CustomerLanguageSelect({ className = "" }: { className?: string }) {
  const language = useContext(CustomerLanguageContext);
  if (!language) return null;

  return (
    <label
      className={`border-border bg-card text-foreground inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 text-sm ${className}`}
    >
      <span className="sr-only">{language.t("language")}</span>
      <select
        aria-label={language.t("language")}
        value={language.locale}
        onChange={(event) => language.setLocale(resolveCustomerLocale(event.target.value))}
        className="focus-visible:ring-ring min-h-11 min-w-0 bg-transparent py-2 outline-none focus-visible:ring-2"
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="so" lang="so">
          Soomaali
        </option>
      </select>
    </label>
  );
}
