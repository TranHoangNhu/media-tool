import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Config headers for SharedArrayBuffer (Required by FFmpeg WASM)
  async headers() {
    return [
      {
        // Only apply strict isolation specific pages that need SharedArrayBuffer (FFmpeg)
        source: "/compress-video",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
      // CORS for API Routes we built
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
        ],
      },
    ];
  },
  // Ensure we can optimize images if needed
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
