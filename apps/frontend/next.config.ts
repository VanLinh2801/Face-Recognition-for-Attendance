import type { NextConfig } from "next";

const backendTarget = process.env.BACKEND_PROXY_TARGET ?? "http://localhost:18000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
