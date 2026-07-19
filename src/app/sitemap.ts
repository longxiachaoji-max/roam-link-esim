import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://firstesim.space',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1
    },
    {
      url: 'https://firstesim.space/shop',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8
    }
  ];
}
