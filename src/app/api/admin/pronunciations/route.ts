import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const LEGACY_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "pronunciations");
const PRONUNCIATION_BUCKET =
  process.env.SUPABASE_PRONUNCIATION_BUCKET?.trim() || "pronunciations";

// Turns "Iced Caramel Latte" into "iced-caramel-latte" so the uploaded
// audio gets a tidy, URL-friendly filename instead of a messy label.
function slugifyLabel(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "item";
}

// Browsers can record audio in different formats. This picks the best filename
// extension from the file's MIME type, with webm as the dependable fallback.
function getExtension(contentType: string) {
  if (contentType.includes("ogg")) return "ogg";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  if (contentType.includes("mp4") || contentType.includes("m4a")) return "m4a";
  if (contentType.includes("wav")) return "wav";
  return "webm";
}

// Supabase tells us who is logged in, then Prisma tells us what that user is
// allowed to do inside this cafe app. Both checks matter: login first, role next.
async function ensureAdminUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });
}

// Old pronunciation uploads used to live inside public/uploads/pronunciations.
// If a saved URL points there, this converts it back into a local disk path so
// replacement uploads can clean up the old file.
function getLegacyAbsolutePath(previousUrl: string) {
  if (!previousUrl.startsWith("/uploads/pronunciations/")) {
    return null;
  }

  const relativePath = previousUrl.replace(/^\/+/, "");
  const absolutePath = path.join(process.cwd(), "public", relativePath);

  if (!absolutePath.startsWith(LEGACY_UPLOAD_ROOT)) {
    return null;
  }

  return absolutePath;
}

// New pronunciation uploads live in Supabase Storage. Given a public Supabase
// URL, this extracts the private storage path that the remove() API expects.
function getStoragePathFromPublicUrl(previousUrl: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  try {
    const publicPrefix = new URL(
      `/storage/v1/object/public/${PRONUNCIATION_BUCKET}/`,
      supabaseUrl,
    ).toString();

    if (!previousUrl.startsWith(publicPrefix)) {
      return null;
    }

    return decodeURIComponent(previousUrl.slice(publicPrefix.length));
  } catch {
    return null;
  }
}

// When an admin records a better pronunciation, this removes the old audio.
// It supports both the old local-file world and the current Supabase bucket.
async function removePreviousUpload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  previousUrl: string,
) {
  const legacyAbsolutePath = getLegacyAbsolutePath(previousUrl);

  if (legacyAbsolutePath) {
    try {
      await unlink(legacyAbsolutePath);
    } catch {
      // Ignore missing or already-removed files.
    }

    return;
  }

  const storagePath = getStoragePathFromPublicUrl(previousUrl);

  if (!storagePath) {
    return;
  }

  await supabase.storage.from(PRONUNCIATION_BUCKET).remove([storagePath]);
}

// POST /api/admin/pronunciations
// Receives one recorded audio file from the admin UI, stores it in Supabase,
// optionally deletes the old recording, and returns the new public audio URL.
export async function POST(request: Request) {
  try {
    // Step 1: identify the user. The API is private because only staff should
    // be able to upload the sound clips waiters hear during ordering.
    const supabase = await createClient();
    const currentUser = await ensureAdminUser(supabase);

    // Step 2: only active admins and managers can manage pronunciation audio.
    if (
      !currentUser ||
      !currentUser.isActive ||
      !["ADMIN", "MANAGER"].includes(currentUser.role)
    ) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // Step 3: unpack the multipart form. The recorder sends the audio file plus
    // a label, whether it belongs to a product/modifier, and maybe an old URL.
    const formData = await request.formData();
    const file = formData.get("file");
    const label = String(formData.get("label") || "").trim();
    const entityType = String(formData.get("entityType") || "product").trim();
    const previousUrl = String(formData.get("previousUrl") || "").trim();

    // Step 4: make sure we actually received audio. This keeps random uploads
    // and empty recordings from sneaking into the storage bucket.
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    }

    if (!file.type.startsWith("audio/")) {
      return NextResponse.json({ error: "Only audio files are allowed." }, { status: 400 });
    }

    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio file must be between 1 byte and 5 MB." },
        { status: 400 },
      );
    }

    // Step 5: build a storage path like product/1712345678-latte.webm. The
    // entity folder keeps product and modifier audio easy to browse later.
    const safeEntityType = entityType === "modifier" ? "modifier" : "product";
    const extension = getExtension(file.type);
    const fileName = `${Date.now()}-${slugifyLabel(label)}.${extension}`;
    const storagePath = `${safeEntityType}/${fileName}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Step 6: upload the fresh recording to Supabase Storage. upsert is false so
    // a filename collision fails loudly instead of silently replacing a file.
    const { error: uploadError } = await supabase.storage
      .from(PRONUNCIATION_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "audio/webm",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(
        uploadError.message.includes("Bucket not found")
          ? `Supabase storage bucket "${PRONUNCIATION_BUCKET}" was not found.`
          : uploadError.message,
      );
    }

    // Step 7: if this recording replaces an older one, clean up the old audio
    // after the new upload succeeds. That order avoids losing the only copy.
    if (previousUrl) {
      await removePreviousUpload(supabase, previousUrl);
    }

    // Step 8: Supabase gives us a public URL that can be saved on the product or
    // modifier record and played back by the waiter/cashier ordering screens.
    const { data: publicUrlData } = supabase.storage
      .from(PRONUNCIATION_BUCKET)
      .getPublicUrl(storagePath);

    return NextResponse.json({
      url: publicUrlData.publicUrl,
    });
  } catch (error) {
    console.error("POST /api/admin/pronunciations error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload pronunciation audio.",
      },
      { status: 500 },
    );
  }
}
