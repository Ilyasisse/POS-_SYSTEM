import type { NextConfig } from "next";
import { getProductImageRemotePatterns } from "./src/lib/products/product-image-config";

const isVercelBuild = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  images: {
    // Allow Next.js to optimize public IMG_Products images from our configured
    // Supabase host. Reject other hosts, buckets, signed URLs, and query strings.
    // This only allows fetching images; it does not make the bucket public.
    remotePatterns: getProductImageRemotePatterns(),
    // Keep Next.js's default small-image widths and add 400px for desktop menu cards.
    // These are available download widths, not CSS display sizes. The browser
    // chooses a suitable width using the Image's sizes prop and screen density.
    // Larger widths remain available through Next.js's default deviceSizes.
    imageSizes: [32, 48, 64, 96, 128, 256, 384, 400],
  },
  async redirects() {
    return [
      {
        source: "/admin/dashboard",
        destination: "/admin",
        permanent: false,
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
  typescript: {
    tsconfigPath: isVercelBuild ? "tsconfig.vercel.json" : "tsconfig.json",
  },
};

export default nextConfig;
