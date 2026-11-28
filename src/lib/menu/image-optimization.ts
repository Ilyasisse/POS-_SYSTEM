const PUBLIC_IMAGE_PATH = "/storage/v1/object/public/";
const SIGNED_PRODUCT_IMAGE_PATH = "/storage/v1/object/sign/IMG_Products/";

/** Limit optimization to public storage and this project's signed menu photos. */
export function getMenuImageRemotePatterns(supabaseUrl: string | undefined) {
  if (!supabaseUrl) return [];

  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:" || url.port || url.username || url.password) {
      return [];
    }

    const origin = {
      protocol: "https" as const,
      hostname: url.hostname,
      port: "",
    };

    return [
      { ...origin, pathname: `${PUBLIC_IMAGE_PATH}**`, search: "" },
      // Signed tokens vary by source URL. Cached menu-photo copies are public.
      { ...origin, pathname: `${SIGNED_PRODUCT_IMAGE_PATH}**` },
    ];
  } catch {
    return [];
  }
}

function hasSingleSignedToken(url: URL) {
  return (
    Boolean(url.searchParams.get("token")?.trim()) &&
    url.searchParams.getAll("token").length === 1 &&
    [...url.searchParams.keys()].every((key) => key === "token")
  );
}

/** Unsupported sources retain direct loading rather than being proxied. */
export function shouldOptimizeMenuImage(
  src: string,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
) {
  if (src.startsWith("/") && !src.startsWith("//")) {
    // Next.js defaults reject query strings on local optimizer sources.
    return !src.includes("?");
  }

  try {
    const url = new URL(src);
    return getMenuImageRemotePatterns(supabaseUrl).some((pattern) => {
      const prefix = pattern.pathname.slice(0, -2);
      return (
        url.protocol === `${pattern.protocol}:` &&
        url.hostname === pattern.hostname &&
        url.port === pattern.port &&
        !url.username &&
        !url.password &&
        url.pathname.startsWith(prefix) &&
        url.pathname.length > prefix.length &&
        ("search" in pattern ? url.search === pattern.search : hasSingleSignedToken(url))
      );
    });
  } catch {
    return false;
  }
}
