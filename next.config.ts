import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const isVercelBuild = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
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

export default withSentryConfig(nextConfig, {
  silent: true,
});
