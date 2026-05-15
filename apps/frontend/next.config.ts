import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const backendTarget =
  process.env.BACKEND_PROXY_TARGET ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  "http://localhost:8000";

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
      {
        source: "/api/ws/v1/:path*",
        destination: `${backendTarget}/api/ws/v1/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
