import type { MetadataRoute } from 'next';
import {
  createAutomaticEsimDestination,
  ESIM_DESTINATIONS,
  getEsimDestinationForCountry,
  getEsimDestinationHref
} from '@/lib/esim-destinations';
import { getActiveEsimCountries, getActiveEsimPlanSitemapEntries } from '@/lib/esim-seo-products';
import { getActivePhysicalProductSitemapEntries } from '@/lib/physical-store-seo';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [activeCountries, esimPlans, physicalProducts] = await Promise.all([
    getActiveEsimCountries(),
    getActiveEsimPlanSitemapEntries(),
    getActivePhysicalProductSitemapEntries()
  ]);
  const destinations = [...ESIM_DESTINATIONS];
  for (const country of activeCountries) {
    if (getEsimDestinationForCountry(country)) continue;
    const automaticDestination = createAutomaticEsimDestination(country);
    if (automaticDestination) destinations.push(automaticDestination);
  }
  const destinationUrls = [...new Set(destinations.map(destination => getEsimDestinationHref(destination)))];
  const planUrls = esimPlans.flatMap(plan => {
    const destination = getEsimDestinationForCountry(plan.country) || createAutomaticEsimDestination(plan.country);
    return destination
      ? [{
          url: `https://firstesim.space/esim/${encodeURIComponent(destination.slug)}/plan/${encodeURIComponent(plan.id)}`
        }]
      : [];
  });
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
    ...planUrls.map(plan => ({
      url: plan.url,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.75
    })),
    {
      url: 'https://firstesim.space/shop',
      lastModified,
      changeFrequency: 'daily',
      priority: 0.8
    },
    {
      url: 'https://firstesim.space/shop/rental',
      lastModified,
      changeFrequency: 'daily',
      priority: 0.85
    },
    ...physicalProducts.map(product => ({
      url: `https://firstesim.space/shop/${encodeURIComponent(product.id)}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : lastModified,
      changeFrequency: 'weekly' as const,
      priority: product.category === 'rental' ? 0.8 : 0.7
    }))
  ];
}
