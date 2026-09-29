"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [router]);

  return null;
}
