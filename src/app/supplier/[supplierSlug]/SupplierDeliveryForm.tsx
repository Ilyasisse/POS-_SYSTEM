"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

export default function SupplierDeliveryForm({
  supplierName,
  supplierSlug,
}: {
  supplierName: string;
  supplierSlug: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || state === "sending") return;
    setState("sending");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    formData.set("receipt", file);

    try {
      const response = await fetch(`/api/suppliers/${encodeURIComponent(supplierSlug)}/deliveries`, {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { error?: string; warning?: string | null };
      if (!response.ok) throw new Error(data.error || "Delivery submission failed.");
      setState("success");
      setMessage(
        data.warning
          ? "Delivery received. Receipt extraction needs manager review."
          : "Delivery received and sent to the manager for verification.",
      );
      setFile(null);
      setPreview(null);
      event.currentTarget.reset();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Delivery submission failed.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/60 p-5 text-center">
        <span className="block text-sm font-bold text-slate-900">Receipt or delivery proof</span>
        <span className="mt-1 block text-xs text-slate-500">JPEG, PNG, WebP, or HEIC · maximum 10 MB</span>
        <input
          name="receipt"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          required
          onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null;
            setFile(nextFile);
            setPreview(nextFile ? URL.createObjectURL(nextFile) : null);
            setState("idle");
            setMessage("");
          }}
          className="mt-4 block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-3 file:font-bold file:text-white"
        />
      </label>

      {preview ? (
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
          <Image src={preview} alt="Receipt preview" fill unoptimized className="object-contain" />
        </div>
      ) : null}

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-800">Delivery notes (optional)</span>
        <textarea
          name="notes"
          maxLength={2000}
          rows={4}
          placeholder={`Notes for Mash Allah Cafe about this ${supplierName} delivery`}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      {message ? (
        <p role="status" className={`rounded-2xl px-4 py-3 text-sm font-semibold ${state === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!file || state === "sending"}
        className="min-h-14 w-full rounded-2xl bg-blue-600 px-5 text-base font-black text-white shadow-lg shadow-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "sending" ? "Uploading and reading receipt…" : "Submit delivery"}
      </button>
      <p className="text-center text-xs leading-5 text-slate-500">
        Inventory is not updated until a manager checks the physical delivery and approves it.
      </p>
    </form>
  );
}
