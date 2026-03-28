import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const LEGACY_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "pronunciations");
const PRONUNCIATION_BUCKET =
  process.env.SUPABASE_PRONUNCIATION_BUCKET?.trim() || "pronunciations";

function slugifyLabel(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "item";
}

function getExtension(contentType: string) {
  if (contentType.includes("ogg")) return "ogg";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  if (contentType.includes("mp4") || contentType.includes("m4a")) return "m4a";
  if (contentType.includes("wav")) return "wav";
  return "webm";
}

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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const currentUser = await ensureAdminUser(supabase);

    if (
      !currentUser ||
      !currentUser.isActive ||
      !["ADMIN", "MANAGER"].includes(currentUser.role)
    ) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const label = String(formData.get("label") || "").trim();
    const entityType = String(formData.get("entityType") || "product").trim();
    const previousUrl = String(formData.get("previousUrl") || "").trim();

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

    const safeEntityType = entityType === "modifier" ? "modifier" : "product";
    const extension = getExtension(file.type);
    const fileName = `${Date.now()}-${slugifyLabel(label)}.${extension}`;
    const storagePath = `${safeEntityType}/${fileName}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

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

    if (previousUrl) {
      await removePreviousUpload(supabase, previousUrl);
    }

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
