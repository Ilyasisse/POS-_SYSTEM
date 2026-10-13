import type { NextConfig } from "next";

const isVercelBuild = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // Build a self-contained Node.js server only for Docker images.
  // Keep the existing Vercel build configuration unchanged.
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
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
