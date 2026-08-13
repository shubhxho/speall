import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The registry is read from disk at runtime, so it has to survive the
  // serverless bundle's file tracing.
  outputFileTracingIncludes: {
    "/**": ["./data/registry.json"],
  },
};

export default nextConfig;
