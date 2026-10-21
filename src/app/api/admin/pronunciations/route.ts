import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

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
async function ensureAdminUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return prisma.staff.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });
}

// POST /api/admin/pronunciations
// Receives one recorded audio file from the admin UI, stores it in Supabase,
// and returns a new public audio URL for the catalog form to save.
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
      !hasPermission(currentUser, PERMISSIONS.CATALOG_MANAGE)
    ) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // Step 3: unpack the multipart form. The recorder sends the audio file plus
    // a label and whether it belongs to a product or modifier.
    const formData = await request.formData();
    const file = formData.get("file");
    const rawLabel = formData.get("label") ?? "";
    const rawEntityType = formData.get("entityType");
    if (typeof rawLabel !== "string" || rawLabel.trim().length > 120) {
      return NextResponse.json(
        { error: "Audio label must use 120 characters or fewer." },
        { status: 400 },
      );
    }
    const label = rawLabel.trim();
    const entityType =
      typeof rawEntityType === "string" ? rawEntityType.trim() : "";
    if (entityType !== "product" && entityType !== "modifier") {
      return NextResponse.json(
        { error: "Choose a product or modifier recording." },
        { status: 400 },
      );
    }

    // Step 4: make sure we actually received audio. This keeps random uploads
    // and empty recordings from sneaking into the storage bucket.
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Audio file is required." },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("audio/")) {
      return NextResponse.json(
        { error: "Only audio files are allowed." },
        { status: 400 },
      );
    }

    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio file must be between 1 byte and 5 MB." },
        { status: 400 },
      );
    }

    // Step 5: give each recording its own UUID-based storage path. The
    // entity folder keeps product and modifier audio easy to browse later.
    const extension = getExtension(file.type);
    const fileName = `${randomUUID()}-${slugifyLabel(label)}.${extension}`;
    const storagePath = `${entityType}/${fileName}`;
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

    // Uploads do not replace saved audio. The editor may be cancelled, and
    // multiple products/modifiers can reference the same recording. Cleanup must
    // check committed catalog references separately before removing any object.
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
