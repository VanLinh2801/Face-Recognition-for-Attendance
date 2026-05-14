import type { NextConfig } from "next";

const backendTarget = process.env.BACKEND_PROXY_TARGET ?? "http://backend:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendTarget}/api/v1/:path*`,
      },
      {
        source: "/api/ws/:path*",
        destination: `${backendTarget}/api/ws/:path*`,
      },
    ];
  },
};

export default nextConfig;
