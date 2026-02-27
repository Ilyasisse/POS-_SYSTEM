import type { NextConfig } from "next";

const isVercelBuild = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath: isVercelBuild ? "tsconfig.vercel.json" : "tsconfig.json",
  },
};

export default nextConfig;
