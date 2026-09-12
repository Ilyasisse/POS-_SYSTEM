export type ProductMenuContent = {
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isPopular: boolean;
};

function optionalText(value: unknown, label: string, maxLength: number) {
  const text = String(value ?? "").trim();

  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  return text || null;
}

function imageUrl(value: unknown) {
  const url = optionalText(value, "Image URL", 2048);

  if (!url) {
    return null;
  }

  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return url;
    }
  } catch {
    // Handled by the validation error below.
  }

  throw new Error("Image URL must be an http(s) URL or a site-relative path.");
}

export function parseProductMenuContent(input: {
  description?: unknown;
  imageUrl?: unknown;
  isActive?: unknown;
  isPopular?: unknown;
}): ProductMenuContent {
  return {
    description: optionalText(input.description, "Description", 1000),
    imageUrl: imageUrl(input.imageUrl),
    isActive: input.isActive === true || input.isActive === "on",
    isPopular: input.isPopular === true || input.isPopular === "on",
  };
}
