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
      // Specific configuration for blob storage
      {
        protocol: "https",
        hostname: "tikuntechwebimages.blob.core.windows.net",
      },
      {
        protocol: "https",
        hostname: "*.blob.core.windows.net",
      },
    ],
    // Alternative: Use a custom loader for blob storage
    loader: 'default',
    // Disable static image optimization for external images
    unoptimized: process.env.NODE_ENV === 'development',
  },
};

export default nextConfig;
