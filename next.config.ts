import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    appIsrStatus: false,
  },
  // Clean config for Vercel deployment
} as any;

export default nextConfig;
