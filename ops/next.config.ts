import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The back office must never be indexed. robots.ts covers crawlers that ask;
  // this header covers the ones that just follow a link.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
