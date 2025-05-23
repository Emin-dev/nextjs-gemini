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
    // any other experimental flags can go here
  },
  allowedDevOrigins: [
    "3002-firebase-newt-1748022315534.cluster-3gc7bglotjgwuxlqpiut7yyqt4.cloudworkstations.dev",
    //   "your-cloud-workstation-dev-url.com", // TODO: Replace with your actual Cloud Workstations domain
    //   // You can add more local development domains here if needed, e.g. "localhost:3001"
    //   "3000-firebase-nextjs-geminigit-1747961178572.cluster-3gc7bglotjgwuxlqpiut7yyqt4.cloudworkstations.dev"
  ]
  /* config options here */
};

export default nextConfig;
