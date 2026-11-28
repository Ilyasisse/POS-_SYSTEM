"use client";
import Image from "next/image";
import Link from "next/link";
import { useCustomerTranslations } from "@/components/customer/i18n/CustomerLanguageProvider";
export default function MenuFooter({ cafeName }: { cafeName: string }) {
  const t = useCustomerTranslations();
  return (
    <footer id="contact" className="dark:bg-background bg-[#201108] text-[#f8eee3]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:px-8 xl:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#d09a59]">
              <Image
                src="/newer_logo.png"
                alt={cafeName}
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
            </div>
            <div>
              <p className="text-sm tracking-[0.32em] text-[#f0d4ae] uppercase">{cafeName}</p>
              <p className="text-sm text-white/65">{t("footerTagline")}</p>
            </div>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-7 text-white/62">{t("footerDescription")}</p>
        </div>

        <div>
          <p className="text-lg font-semibold text-white">{t("address")}</p>
          <p className="text-md mt-4 leading-7 text-white/68">Jidka Airport Bosaso</p>
        </div>

        <div>
          <p className="text-lg font-semibold text-white">{t("contact")}</p>
          <p className="mt-4 text-sm leading-7 text-white/68">+252 90 7796071</p>
        </div>

        <div>
          <p className="text-lg font-semibold text-white">{t("openingHours")}</p>
          <p className="mt-4 text-sm leading-7 text-white/68">{t("hours")}</p>
        </div>
      </div>
    </footer>
  );
}
