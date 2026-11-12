export const PRODUCT_DESCRIPTION_MAX_LENGTH = 1000;
export const PRODUCT_IMAGE_URL_MAX_LENGTH = 2048;

export function productImageUrlError(value: string): string | undefined {
  const url = value.trim();
  if (!url) return;

  if (url.length > PRODUCT_IMAGE_URL_MAX_LENGTH) {
    return `Use ${PRODUCT_IMAGE_URL_MAX_LENGTH} characters or fewer.`;
  }

  try {
    const base = "https://menu.invalid";
    if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) {
      if (new URL(url, base).origin === base) return;
    }
    if (/^https?:\/\//i.test(url) && new URL(url).hostname) return;
  } catch {
    // Invalid URLs use the field's validation message below.
  }

  return "Enter an HTTP(S) URL or a path starting with a single slash.";
}

export function parseProductMenuContent(description: string | null, imageUrl: string | null) {
  const trimmedDescription = description?.trim();
  if (
    trimmedDescription !== undefined &&
    trimmedDescription.length > PRODUCT_DESCRIPTION_MAX_LENGTH
  ) {
    throw new Error(
      `Menu description must be ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    );
  }

  const trimmedImageUrl = imageUrl?.trim();
  if (trimmedImageUrl) {
    const error = productImageUrlError(trimmedImageUrl);
    if (error) throw new Error(error);
  }

  return {
    ...(description === null ? {} : { description: trimmedDescription || null }),
    ...(imageUrl === null
      ? {}
      : {
          imageUrl: trimmedImageUrl?.replace(/^https?:/i, (scheme) => scheme.toLowerCase()) || null,
        }),
  };
}
