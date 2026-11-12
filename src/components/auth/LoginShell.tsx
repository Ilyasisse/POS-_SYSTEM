import Image from "next/image";
import type { ReactNode } from "react";
import { ModeToggle } from "@/components/mode-toggle";

export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="absolute right-4 top-4 z-20">
        <ModeToggle />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#fff8ef_0%,#f2dfc7_48%,#e8c18f_100%)] dark:bg-[linear-gradient(135deg,var(--background)_0%,var(--card)_48%,var(--background)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(47,24,13,0.16),transparent)]" />
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </main>
  );
}

export function LoginHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div data-aos="zoom-in" className="text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#f3dcc1] shadow-[0_18px_40px_rgba(176,123,69,0.18)]">
        <Image
          src="/newer_logo.png"
          alt="Mash Allah Cafe"
          width={56}
          height={56}
          className="h-14 w-14 object-contain"
        />
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-[#b07b45] dark:text-primary">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-bold text-foreground">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
