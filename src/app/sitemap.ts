import type { MetadataRoute } from 'next';
import {
  createAutomaticEsimDestination,
  ESIM_DESTINATIONS,
  getEsimDestinationForCountry,
  getEsimDestinationHref
} from '@/lib/esim-destinations';
import { getActiveEsimCountries } from '@/lib/esim-seo-products';
import { getActivePhysicalProductSitemapEntries } from '@/lib/physical-store-seo';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [activeCountries, physicalProducts] = await Promise.all([
    getActiveEsimCountries(),
    getActivePhysicalProductSitemapEntries()
  ]);
  const destinations = [...ESIM_DESTINATIONS];
  for (const country of activeCountries) {
    if (getEsimDestinationForCountry(country)) continue;
    const automaticDestination = createAutomaticEsimDestination(country);
    if (automaticDestination) destinations.push(automaticDestination);
  }
  const destinationUrls = [...new Set(destinations.map(destination => getEsimDestinationHref(destination)))];
  const lastModified = new Date();

  return [
    {
      url: 'https://firstesim.space',
      lastModified,
      changeFrequency: 'daily',
      priority: 1
    },
    {
      url: 'https://firstesim.space/esim',
      lastModified,
      changeFrequency: 'daily',
      priority: 0.9
    },
    ...destinationUrls.map(path => ({
      url: `https://firstesim.space${path}`,
      lastModified,
      changeFrequency: 'daily' as const,
      priority: 0.8
    })),
    {
      url: 'https://firstesim.space/shop',
      lastModified,
      changeFrequency: 'daily',
      priority: 0.8
    },
    ...physicalProducts.map(product => ({
      url: `https://firstesim.space/shop/${encodeURIComponent(product.id)}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : lastModified,
      changeFrequency: 'weekly' as const,
      priority: product.category === 'rental' ? 0.8 : 0.7
    }))
  ];
}
