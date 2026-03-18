"use client";

import { useRouter } from "next/navigation";

export default function RefreshButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.refresh()}
      className="rounded-xl border border-slate-300 px-4 py-2 hover:bg-slate-50"
    >
      🔄 Refresh
    </button>
  );
}