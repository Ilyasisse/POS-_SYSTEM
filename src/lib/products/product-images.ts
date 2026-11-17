import { createClient } from "@supabase/supabase-js";
import { PRODUCT_IMAGE_BUCKET, getProductImageRemotePatterns } from "./product-image-config";
export { PRODUCT_FALLBACK_IMAGE_URL } from "./product-image-config";

/**
 * Extracts the file path inside IMG_Products from a stored product image value.
 * Accepts a bucket-relative path (e.g. "drinks/coffee.webp") or an existing
 * public/signed URL belonging to the configured Supabase host and this bucket.
 * This supports older URL values without rewriting the database or storage.
 *
 * For URLs, checks the host, HTTPS protocol, port, credentials, and bucket,
 * then removes the storage URL prefix and decodes the remaining path.
 * Query strings, including signed tokens, are not part of the returned path;
 * this function does not verify a token or check whether the file exists.
 * Both input forms are checked for unsupported path shapes, such as leading
 * slashes, backslashes, control characters, dot segments, and URL schemes.
 * No network requests are made.
 *
 * @param value - Stored image path or URL; blank/missing values return null.
 * @param supabaseUrl - Expected project URL, defaulting to NEXT_PUBLIC_SUPABASE_URL.
 * @returns The bucket-relative path, or null when the input fails validation.
 */
export function getProductImagePath(
  value: string | null | undefined,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  const source = value?.trim();
  if (!source) return null;
  let objectPath = source;
  if (/^https?:\/\//i.test(source)) {
    const host = getProductImageRemotePatterns(supabaseUrl)[0]?.hostname;
    
    try {
      const url = new URL(source);
      if (
        !host ||
        url.protocol !== "https:" ||
        url.hostname !== host ||
        url.port ||
        url.username ||
        url.password
      )
        return null;
      const prefix = ["/storage/v1/object/sign/", "/storage/v1/object/public/"]
        .map((prefix) => prefix + PRODUCT_IMAGE_BUCKET + "/")
        .find((prefix) => url.pathname.startsWith(prefix));
      if (!prefix) return null;
      objectPath = decodeURIComponent(url.pathname.slice(prefix.length));
    } catch {
      return null;
    }
  }
  if (
    !objectPath ||
    objectPath.startsWith("/") ||
    objectPath.includes("\\") ||
    Array.from(objectPath).some((character) => character.charCodeAt(0) < 32) ||
    objectPath.split("/").some((part) => part === "." || part === "..") ||
    /^[a-z][a-z0-9+.-]*:/i.test(objectPath)
  )
    return null;
  return objectPath;
}
// Reuse the client within this module instance; remember its configuration so
// getPublicProductImageUrl can recreate it if the project URL or key changes.
let storageClient: ReturnType<typeof createClient> | undefined;
let configuredUrl: string | undefined;
let configuredKey: string | undefined;
/**
 * Builds a public IMG_Products URL from a product's stored image path or URL.
 * First calls getProductImagePath to extract and validate the file path, then
 * requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and a valid
 * image-host configuration. Returns null if any of these checks fail.
 *
 * Creates a Supabase client only when needed, reusing it until its URL or key
 * changes. Auth session persistence, token refresh, and URL session detection
 * are disabled because this client only constructs storage URLs.
 *
 * getPublicUrl constructs a URL without fetching the image. The bucket must
 * already be public for that URL to work: this neither changes permissions
 * nor checks file existence. An old signed URL becomes a public URL for the
 * same path; its token is not renewed. Callers choose a fallback for null.
 *
 * @param value - Stored bucket-relative path, public URL, or legacy signed URL.
 * @returns A public image URL, or null for invalid input/missing configuration.
 */
export function getPublicProductImageUrl(value: string | null | undefined): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const objectPath = getProductImagePath(value, url);
  if (!objectPath || !url || !key || !getProductImageRemotePatterns(url).length) return null;
  if (!storageClient || configuredUrl !== url || configuredKey !== key) {
    storageClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    configuredUrl = url;
    configuredKey = key;
  }
  return storageClient.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(objectPath).data.publicUrl;
}
