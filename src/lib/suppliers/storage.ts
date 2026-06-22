import "server-only";

import { createClient } from "@supabase/supabase-js";

const BUCKET =
  process.env.SUPABASE_SUPPLIER_RECEIPTS_BUCKET?.trim() ||
  "supplier-receipts";

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supplier receipt storage is not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function uploadSupplierReceipt(
  objectPath: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const { error } = await storageClient().storage
    .from(BUCKET)
    .upload(objectPath, bytes, { contentType, upsert: false });

  if (error) throw new Error(`Receipt upload failed: ${error.message}`);
  return objectPath;
}

export async function downloadSupplierReceipt(objectPath: string) {
  const { data, error } = await storageClient().storage
    .from(BUCKET)
    .download(objectPath);

  if (error || !data) {
    throw new Error(`Receipt download failed: ${error?.message || "Not found"}`);
  }

  return new Uint8Array(await data.arrayBuffer());
}

export async function createSupplierReceiptUrl(
  objectPath: string,
  expiresInSeconds = 900,
) {
  const { data, error } = await storageClient().storage
    .from(BUCKET)
    .createSignedUrl(objectPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Could not create receipt link: ${error?.message || "Unknown error"}`);
  }

  return data.signedUrl;
}

export async function removeSupplierReceipt(objectPath: string) {
  await storageClient().storage.from(BUCKET).remove([objectPath]);
}
