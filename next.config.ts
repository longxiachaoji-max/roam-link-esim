import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://payment.ecpay.com.tw",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://pbscoymzoghpghcfpvde.supabase.co wss://pbscoymzoghpghcfpvde.supabase.co https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://www.google.com",
  "frame-src 'self' https://payment.ecpay.com.tw",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests"
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
];

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: securityHeaders
    }];
  },
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
