import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: process.env.BACKEND_URL
          ? `${process.env.BACKEND_URL}/api/:path*`
          : "https://api-nextjs.tranhoangnhu.website/api/:path*",
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "1000mb",
      allowedOrigins: [
        "localhost:3000",
        "192.168.1.165:3000",
        "192.168.0.0/16",
      ],
    },
  },
};

export default nextConfig;
