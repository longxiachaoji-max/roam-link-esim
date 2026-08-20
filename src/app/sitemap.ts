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

function latestModified(values: Array<string | null | undefined>) {
  const latest = values.filter((value): value is string => Boolean(value)).sort().at(-1);
  return latest ? new Date(latest) : undefined;
}

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
  const destinationByPath = new Map(
    destinations.map(destination => [getEsimDestinationHref(destination), destination])
  );
  const planUrls = esimPlans.flatMap(plan => {
    const destination = getEsimDestinationForCountry(plan.country) || createAutomaticEsimDestination(plan.country);
    return destination
      ? [{
          url: `https://firstesim.space/esim/${encodeURIComponent(destination.slug)}/plan/${encodeURIComponent(plan.id)}`,
          destinationPath: getEsimDestinationHref(destination),
          updatedAt: plan.updatedAt
        }]
      : [];
  });
  const latestEsimUpdate = latestModified(esimPlans.map(plan => plan.updatedAt));
  const latestPhysicalUpdate = latestModified(physicalProducts.map(product => product.updatedAt));
  const latestSiteUpdate = latestModified([
    latestEsimUpdate?.toISOString(),
    latestPhysicalUpdate?.toISOString()
  ]);

  return [
    {
      url: 'https://firstesim.space',
      lastModified: latestSiteUpdate,
      changeFrequency: 'daily',
      priority: 1
    },
    {
      url: 'https://firstesim.space/esim',
      lastModified: latestEsimUpdate,
      changeFrequency: 'daily',
      priority: 0.9
    },
    ...[...destinationByPath.keys()].map(path => ({
      url: `https://firstesim.space${path}`,
      lastModified: latestModified(
        planUrls.filter(plan => plan.destinationPath === path).map(plan => plan.updatedAt)
      ),
      changeFrequency: 'daily' as const,
      priority: 0.8
    })),
    ...planUrls.map(plan => ({
      url: plan.url,
      lastModified: plan.updatedAt ? new Date(plan.updatedAt) : undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.75
    })),
    {
      url: 'https://firstesim.space/shop',
      lastModified: latestPhysicalUpdate,
      changeFrequency: 'daily',
      priority: 0.8
    },
    {
      url: 'https://firstesim.space/shop/rental',
      lastModified: latestPhysicalUpdate,
      changeFrequency: 'daily',
      priority: 0.85
    },
    {
      url: 'https://firstesim.space/company-discount',
      changeFrequency: 'weekly',
      priority: 0.55
    },
    ...physicalProducts.map(product => ({
      url: `https://firstesim.space/shop/${encodeURIComponent(product.id)}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : undefined,
      changeFrequency: 'weekly' as const,
      priority: product.category === 'rental' ? 0.8 : 0.7
    }))
  ];
}
