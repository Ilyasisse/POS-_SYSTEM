import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { CUSTOMER_LOCALE_COOKIE, resolveCustomerLocale } from "@/i18n/customer";
import { CustomerLanguageProvider } from "./CustomerLanguageProvider";

export default async function CustomerLanguageLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const locale = resolveCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value);
  return <CustomerLanguageProvider initialLocale={locale}>{children}</CustomerLanguageProvider>;
}
