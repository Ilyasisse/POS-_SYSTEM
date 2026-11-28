export const PRODUCT_IMAGE_BUCKET = "IMG_Products";
export const PRODUCT_FALLBACK_IMAGE_PATH = "placeholder/product-fallback.webp";

/**
 * Allows public IMG_Products URLs on the configured Supabase host.
 * Legacy signed URLs are converted before they reach the optimizer.
 */
export function getSupabaseProductImagePattern(supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  if (!supabaseUrl) return undefined;
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:" || url.port || url.username || url.password) return undefined;
    return {
      protocol: "https" as const,
      hostname: url.hostname,
      port: "",
      pathname: "/storage/v1/object/public/" + PRODUCT_IMAGE_BUCKET + "/**",
      search: "",
    };
  } catch {
    return undefined;
  }
}

/** Parses the public R2 URL and normalizes the pathname to a directory prefix. */
export function getR2ProductImageBase(
  r2BaseUrl = process.env.NEXT_PUBLIC_PRODUCT_IMAGE_R2_BASE_URL,
) {
  const value = r2BaseUrl?.trim();
  if (!value || !/^https:\/\//i.test(value) || /[?#\\]/.test(value)) return undefined;

  try {
    const url = new URL(value);
    if (
      url.port ||
      url.username ||
      url.password ||
      // Only literal hosts and paths may be used to build a Next.js glob.
      !/^[a-z0-9.-]+$/.test(url.hostname) ||
      !/^[a-z0-9._~%/-]+$/i.test(url.pathname)
    ) {
      return undefined;
    }
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url;
  } catch {
    return undefined;
  }
}

export function getProductImageRemotePatterns(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  r2BaseUrl = process.env.NEXT_PUBLIC_PRODUCT_IMAGE_R2_BASE_URL,
) {
  const supabase = getSupabaseProductImagePattern(supabaseUrl);
  const patterns = supabase ? [supabase] : [];
  const r2 = getR2ProductImageBase(r2BaseUrl);
  if (r2) {
    patterns.push({
      protocol: "https",
      hostname: r2.hostname,
      port: "",
      pathname: r2.pathname + "**",
      search: "",
    });
  }
  return patterns;
}

// Derive the fallback's host from the same rules used by Next.js. Evaluated
// when this module loads; no matching rule means there is no usable image host.
const imageHost = getSupabaseProductImagePattern()?.hostname;

/**
 * Public URL for the shared product placeholder, built without a storage client.
 * Used by callers when a product image is missing or cannot be displayed.
 * Empty when the host configuration is invalid/missing; callers must handle
 * that case rather than passing an empty src to Next.js Image.
 * Constructing this URL does not verify the placeholder exists or is accessible.
 */
export const PRODUCT_FALLBACK_IMAGE_URL = imageHost
  ? "https://" +
    imageHost +
    "/storage/v1/object/public/" +
    PRODUCT_IMAGE_BUCKET +
    "/" +
    PRODUCT_FALLBACK_IMAGE_PATH
  : "";
