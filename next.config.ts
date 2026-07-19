import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pbscoymzoghpghcfpvde.supabase.co',
        pathname: '/storage/v1/object/public/physical-products/**'
      }
    ]
  }
};

export default nextConfig;
