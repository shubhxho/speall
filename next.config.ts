import type { NextConfig } from "next";

/**
 * Responses are a pure function of the URL: the index is a committed snapshot
 * that only changes when the weekly refresh commits, and nothing here is
 * user-specific. Next marks dynamically-rendered pages `private, no-store` by
 * default, so every request was reaching the lambda and paying a cold start.
 *
 * Caching at the edge with a long stale window means a repeat URL is served
 * without the function running at all, and a refresh deploy invalidates it.
 * /api/refresh is deliberately excluded — it mutates.
 */
const PAGE_CACHE = "public, s-maxage=3600, stale-while-revalidate=604800";

const nextConfig: NextConfig = {
  // The registry is read from disk at runtime, so it has to survive the
  // serverless bundle's file tracing.
  outputFileTracingIncludes: {
    "/**": ["./data/registry.json"],
  },

  async headers() {
    return [
      { source: "/", headers: [{ key: "Cache-Control", value: PAGE_CACHE }] },
      { source: "/d/:path*", headers: [{ key: "Cache-Control", value: PAGE_CACHE }] },
    ];
  },
};

export default nextConfig;
