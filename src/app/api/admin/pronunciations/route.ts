import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "pronunciations");

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

async function ensureAdminUser() {
  const supabase = await createClient();
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

async function removePreviousUpload(previousUrl: string) {
  if (!previousUrl.startsWith("/uploads/pronunciations/")) {
    return;
  }

  const relativePath = previousUrl.replace(/^\/+/, "");
  const absolutePath = path.join(process.cwd(), "public", relativePath);

  if (!absolutePath.startsWith(UPLOAD_ROOT)) {
    return;
  }

  try {
    await unlink(absolutePath);
  } catch {
    // Ignore missing or already-removed files.
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await ensureAdminUser();

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
    const targetDirectory = path.join(UPLOAD_ROOT, safeEntityType);
    const absolutePath = path.join(targetDirectory, fileName);

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

    if (previousUrl) {
      await removePreviousUpload(previousUrl);
    }

    return NextResponse.json({
      url: `/uploads/pronunciations/${safeEntityType}/${fileName}`,
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
