import type { NextConfig } from "next";
import { getMenuImageRemotePatterns } from "./src/lib/menu/image-optimization";

const isVercelBuild = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  images: {
    // Menu cards reach 390px; avoid jumping from 384px straight to 640px.
    imageSizes: [32, 48, 64, 96, 128, 256, 384, 400],
    remotePatterns: getMenuImageRemotePatterns(process.env.NEXT_PUBLIC_SUPABASE_URL),
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
