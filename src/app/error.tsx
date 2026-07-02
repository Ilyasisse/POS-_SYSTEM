"use client";

import { Button } from "@/components/ui/button";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Card } from "@/components/ui/card";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Root app error boundary caught an error:", error);
  }, [error]);

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
          Mash Allah Cafe
        </p>
        <h1 className="mt-3 text-3xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          The page could not finish loading. Try again, or return to a safe area
          of the cafe system.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            onClick={reset}
            className="flex min-h-12 items-center justify-center rounded-2xl bg-[#2f180d] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(47,24,13,0.22)] transition hover:-translate-y-0.5 hover:bg-[#442719] focus:outline-none focus:ring-2 focus:ring-[#d09a59] focus:ring-offset-2"
          >
            Try again
          </Button>
          <Button asChild variant="outline" className="min-h-12 rounded-2xl">
            <Link href="/menu">Go to menu</Link>
          </Button>
        </div>

        <Button
          asChild
          variant="secondary"
          className="mt-3 min-h-12 rounded-2xl"
        >
          <Link href="/staff-login">Staff login</Link>
        </Button>
      </Card>
    </main>
  );
}
