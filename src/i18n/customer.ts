import { createTranslator } from "next-intl";
import en from "./messages/en.json";
import so from "./messages/so.json";

export const CUSTOMER_LOCALE_COOKIE = "cafe-customer-locale";
export const CUSTOMER_LOCALES = ["en", "so"] as const;
export type CustomerLocale = (typeof CUSTOMER_LOCALES)[number];
export type CustomerMessageKey = keyof typeof en;
export type CustomerMessage =
  | string
  | CustomerMessage[]
  | {
      key: CustomerMessageKey;
      values?: Record<string, string | number>;
    };

export function resolveCustomerLocale(value: unknown): CustomerLocale {
  return value === "so" ? "so" : "en";
}

export function customerLocaleCookie(locale: CustomerLocale, secure: boolean) {
  return `${CUSTOMER_LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function createCustomerTranslator(locale: CustomerLocale) {
  return createTranslator({ locale, messages: locale === "so" ? so : en });
}

export type CustomerTranslator = ReturnType<typeof createCustomerTranslator>;

export function formatCustomerMessage(message: CustomerMessage, t: CustomerTranslator): string {
  if (Array.isArray(message))
    return message
      .map((item) => formatCustomerMessage(item, t))
      .filter(Boolean)
      .join(" ");
  return typeof message === "string" ? message : t(message.key, message.values);
}
