import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModeToggle } from "@/components/mode-toggle";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="absolute right-4 top-4 z-20">
        <ModeToggle />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#fff8ef_0%,#f2dfc7_48%,#e8c18f_100%)] dark:bg-[linear-gradient(135deg,#1d120d_0%,#2c1b12_48%,#15100d_100%)]" />
      <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(47,24,13,0.16),transparent)]" />

      <Card className="relative z-10 w-full max-w-lg gap-0 rounded-[30px] border-border bg-card/90 p-6 text-center shadow-[0_26px_80px_rgba(65,39,21,0.16)] backdrop-blur sm:p-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#f3dcc1] shadow-[0_18px_40px_rgba(176,123,69,0.18)]">
          <Image
            src="/newer_logo.png"
            alt="Mash Allah Cafe"
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
            priority
          />
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-[#b07b45]">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold text-foreground">
          Page not found
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          This page is not available. Head back to the menu, customer login, or
          staff access.
        </p>

        <Button asChild variant="outline" className="mt-4 min-h-12 rounded-2xl">
          <Link href="/">Head back</Link>
        </Button>
      </Card>
    </main>
  );
}
