export const PRODUCT_IMAGE_BUCKET = "IMG_Products";
export const PRODUCT_FALLBACK_IMAGE_PATH = "placeholder/product-fallback.webp";

/**
 * Builds the remotePatterns rules used by Next.js to allow product images.
 * Reads the project hostname from the Supabase URL rather than hardcoding it.
 * The resulting rule allows only HTTPS public IMG_Products URLs on that host,
 * including nested folders, with no query string or custom port.
 *
 * Also lets product-image helpers reuse the same validated hostname. Signed
 * storage URLs do not match this public-path rule. This only describes allowed
 * image URLs: it does not fetch files, check existence, or make a bucket public.
 *
 * @param supabaseUrl - Project URL, defaulting to NEXT_PUBLIC_SUPABASE_URL.
 * @returns One host/bucket rule, or [] for a missing/malformed URL, non-HTTPS
 * protocol, embedded credentials, or a non-default port.
 */
export function getProductImageRemotePatterns(supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  if (!supabaseUrl) return [];
  try {
    const url = new URL(supabaseUrl);
    
    if (url.protocol !== "https:" || url.port || url.username || url.password) return [];
    return [
      {
        protocol: "https" as const,
        hostname: url.hostname,
        port: "",
        // ** includes any file path beneath this bucket, including subfolders.
        pathname: "/storage/v1/object/public/" + PRODUCT_IMAGE_BUCKET + "/**",
        search: "", // Require no query string; do not allow token/query variants.
      },
    ];
  } catch {
    return [];
  }
}

// Derive the fallback's host from the same rules used by Next.js. Evaluated
// when this module loads; no matching rule means there is no usable image host.
const imageHost = getProductImageRemotePatterns()[0]?.hostname;

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

 
