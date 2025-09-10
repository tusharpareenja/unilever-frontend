import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // Allows any hostname with https
      },
      {
        protocol: "http",
        hostname: "**", // Allows any hostname with http
      },
    ],
  },
};

export default nextConfig;
