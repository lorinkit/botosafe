import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    domains: ["localhost", "botosafe.website"],
  },
};

export default nextConfig;
