import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables the `use cache` directive, the Next 16 mechanism for caching a
  // response that would otherwise render dynamically on every request.
  cacheComponents: true,

  // The registry is read from disk at runtime, so it has to survive the
  // serverless bundle's file tracing.
  outputFileTracingIncludes: {
    "/**": ["./data/registry.json"],
  },
};

export default nextConfig;
