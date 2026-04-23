import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence the "multiple lockfiles" warning — root package.json is just for concurrently
  outputFileTracingRoot: path.join(__dirname, "../"),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  },
};

export default nextConfig;
