import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/suppliers/validation";
import SupplierDeliveryForm from "./SupplierDeliveryForm";
import SupplierSignOutButton from "./SupplierSignOutButton";

export default async function SupplierPortalPage({
  params,
}: {
  params: Promise<{ supplierSlug: string }>;
}) {
  const { supplierSlug } = await params;
  const supplier = await prisma.supplier.findUnique({
    where: { slug: supplierSlug },
    select: { name: true, slug: true, googleEmail: true, isActive: true },
  });
  if (!supplier || !supplier.isActive) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const returnPath = `/supplier/${supplier.slug}`;
  const authorized = Boolean(
    user?.email &&
    supplier.googleEmail &&
    normalizeEmail(user.email) === normalizeEmail(supplier.googleEmail),
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-8">
        <header className="mb-7 text-center">
          <Image src="/newer_logo.png" alt="Mash Allah Cafe" width={88} height={88} className="mx-auto h-20 w-20 object-contain" priority />
          <p className="mt-3 text-xs font-black uppercase tracking-[0.22em] text-blue-600">Supplier delivery</p>
          <h1 className="mt-2 text-2xl font-black">{supplier.name}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Photograph the full receipt clearly, confirm the preview, and add any delivery notes before submitting.
          </p>
        </header>

        {!user ? (
          <div className="rounded-3xl bg-slate-50 p-5 text-center">
            <p className="text-sm font-semibold text-slate-700">Sign in with the Google email assigned to this supplier.</p>
            <Link href={`/auth/supplier-google/start?next=${encodeURIComponent(returnPath)}`} className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-blue-600 px-5 font-bold text-white">
              Continue with Google
            </Link>
          </div>
        ) : !authorized ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-center text-red-800">
            <h2 className="font-black">Unauthorized account</h2>
            <p className="mt-2 text-sm">The signed-in Google email is not assigned to {supplier.name}.</p>
            <SupplierSignOutButton />
          </div>
        ) : (
          <SupplierDeliveryForm supplierName={supplier.name} supplierSlug={supplier.slug} />
        )}
      </div>
    </main>
  );
}
