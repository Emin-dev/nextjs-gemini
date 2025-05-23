import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    allowedDevOrigins: [
      "your-cloud-workstation-dev-url.com", // TODO: Replace with your actual Cloud Workstations domain
      // You can add more local development domains here if needed, e.g. "localhost:3001"
    ],
  }
  /* config options here */
};

export default nextConfig;
