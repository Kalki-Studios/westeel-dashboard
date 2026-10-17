import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/x9admin",
        destination: "/admin",
      },
      {
        source: "/x9admin/:path*",
        destination: "/admin/:path*",
      },
    ];
  },
};

export default nextConfig;
