import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/auth', '/games', '/member', '/topup']
    },
    sitemap: 'https://firstesim.space/sitemap.xml',
    host: 'https://firstesim.space'
  };
}
