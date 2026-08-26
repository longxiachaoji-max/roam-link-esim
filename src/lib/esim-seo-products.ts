import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { EsimDestination } from '@/lib/esim-destinations';
import { compareEsimPlanOrder } from '@/lib/esim-plan-sort';

export interface EsimSeoPlan {
  id: string;
  name: string;
  country: string;
  dataAmount: string;
  validityDays: number;
  price: number;
  description: string;
}

export interface EsimSeoPlanGroup {
  id: string;
  country: string;
  dataAmount: string;
  availableDays: number[];
  lowestPrice: number;
  highestPrice: number;
  description: string;
}

export interface EsimPlanDetail {
  canonicalId: string;
  country: string;
  dataAmount: string;
  description: string;
  options: EsimSeoPlan[];
}

export interface EsimDestinationPlanSummary {
  planCount: number;
  lowestPrice: number | null;
  availableDays: number[];
  featureLabels: string[];
  plans: EsimSeoPlanGroup[];
}

export interface EsimPlanSitemapEntry {
  id: string;
  country: string;
  updatedAt: string | null;
}

export interface PublicEsimReview {
  id: string;
  rating: number;
  smoothnessRating: number;
  comment: string;
  createdAt: string;
}

export interface PublicEsimReviewSummary {
  averageRating: number;
  averageSmoothness: number;
  reviewCount: number;
  reviews: PublicEsimReview[];
}

interface PublicProductApiResponse {
  products?: Array<{
    country?: string;
    plans?: Array<{
      data?: string;
      options?: Array<{ id?: string; days?: number; price?: number; hotspot_sharing?: string }>;
    }>;
  }>;
}

async function getDestinationPlansFromPublicApi(destination: EsimDestination): Promise<EsimSeoPlan[] | null> {
  try {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://firstesim.space').replace(/\/$/, '');
    const response = await fetch(`${siteUrl}/api/products`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) return null;
    const result = await response.json() as PublicProductApiResponse;
    const rows: EsimSeoPlan[] = [];
    for (const countryGroup of result.products || []) {
      const country = String(countryGroup.country || '').trim();
      if (!destination.countries.includes(country)) continue;
      for (const plan of countryGroup.plans || []) {
        const dataAmount = String(plan.data || '標準方案');
        for (const option of plan.options || []) {
          const id = String(option.id || '');
          const validityDays = Number(option.days || 0);
          const price = Number(option.price || 0);
          if (!id || validityDays <= 0 || price <= 0) continue;
          rows.push({
            id,
            name: `${country} ${dataAmount}`,
            country,
            dataAmount,
            validityDays,
            price,
            description: String(option.hotspot_sharing || '').trim()
          });
        }
      }
    }
    return rows.length ? rows : null;
  } catch (error) {
    console.error(`Public plan fallback failed for ${destination.slug}:`, error);
    return null;
  }
}

export async function getActiveEsimCountries() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRoleKey) return [];

  const supabase = createClient(url, serviceRoleKey);
  const { data, error } = await supabase
    .from('products')
    .select('country')
    .eq('is_active', true)
    .order('country', { ascending: true })
    .limit(2000);

  if (error || !data) {
    console.error('Active eSIM countries failed:', error?.message || 'No data');
    return [];
  }

  return [...new Set(data.map(row => String(row.country || '').trim()).filter(Boolean))];
}

export async function getEsimDestinationPlanSummary(destination: EsimDestination): Promise<EsimDestinationPlanSummary> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRoleKey) {
    return { planCount: 0, lowestPrice: null, availableDays: [], featureLabels: [], plans: [] };
  }

  const supabase = createClient(url, serviceRoleKey);
  const fetchPlans = () => supabase
      .from('products')
      .select('id, name, country, data_amount, validity_days, price, description')
      .eq('is_active', true)
      .in('country', destination.countries)
      .order('price', { ascending: true })
      .order('validity_days', { ascending: true })
      .limit(250);

  let { data, error } = await fetchPlans();
  if (error) {
    await new Promise(resolve => setTimeout(resolve, 900));
    ({ data, error } = await fetchPlans());
  }

  if (error || !data) {
    console.error(`SEO plans failed for ${destination.slug}:`, error?.message || 'No data');
    const fallbackPlans = await getDestinationPlansFromPublicApi(destination);
    if (fallbackPlans) return summarizeEsimPlans(fallbackPlans);
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return { planCount: 0, lowestPrice: null, availableDays: [], featureLabels: [], plans: [] };
    }
    throw new Error(`無法更新 ${destination.name} 方案，保留上一版頁面`);
  }

  const normalized = data.map(row => ({
    id: String(row.id),
    name: String(row.name || ''),
    country: String(row.country || ''),
    dataAmount: String(row.data_amount || '標準方案'),
    validityDays: Number(row.validity_days || 0),
    price: Number(row.price || 0),
    description: String(row.description || '').trim()
  })).filter(plan => plan.validityDays > 0 && plan.price > 0);

  return summarizeEsimPlans(normalized);
}

function summarizeEsimPlans(normalized: EsimSeoPlan[]): EsimDestinationPlanSummary {
  const groupedPlans = new Map<string, EsimSeoPlan[]>();
  for (const plan of normalized) {
    const group = groupedPlans.get(plan.dataAmount) || [];
    group.push(plan);
    groupedPlans.set(plan.dataAmount, group);
  }

  const representativePlans = [...groupedPlans.values()]
    .map(options => {
      const canonicalOption = [...options].sort((a, b) =>
        a.validityDays - b.validityDays || a.price - b.price || a.id.localeCompare(b.id)
      )[0];
      return {
        id: canonicalOption.id,
        country: canonicalOption.country,
        dataAmount: canonicalOption.dataAmount,
        availableDays: [...new Set(options.map(option => option.validityDays))].sort((a, b) => a - b),
        lowestPrice: Math.min(...options.map(option => option.price)),
        highestPrice: Math.max(...options.map(option => option.price)),
        description: options.find(option => option.description)?.description || ''
      };
    })
    .sort((a, b) => compareEsimPlanOrder(a.dataAmount, b.dataAmount));

  const searchablePlanText = normalized
    .map(plan => `${plan.name} ${plan.dataAmount} ${plan.description}`)
    .join(' ');
  const featureLabels = [
    /吃到飽|不限量|unlimited/i.test(searchablePlanText) ? '吃到飽方案' : '',
    /每日|daily/i.test(searchablePlanText) ? '每日流量' : '',
    /總量|total/i.test(searchablePlanText) ? '總量型方案' : '',
    /熱點|hotspot/i.test(searchablePlanText) ? '熱點分享' : ''
  ].filter(Boolean);

  return {
    planCount: normalized.length,
    lowestPrice: normalized.length ? Math.min(...normalized.map(plan => plan.price)) : null,
    availableDays: [...new Set(normalized.map(plan => plan.validityDays))].sort((a, b) => a - b).slice(0, 12),
    featureLabels,
    plans: representativePlans
  };
}

export async function getEsimPlanDetail(productId: string, destination: EsimDestination): Promise<EsimPlanDetail | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRoleKey) return null;

  const supabase = createClient(url, serviceRoleKey);
  const { data: selected, error: selectedError } = await supabase
    .from('products')
    .select('id, name, country, data_amount, validity_days, price, description')
    .eq('id', productId)
    .eq('is_active', true)
    .maybeSingle();

  if (selectedError || !selected || !destination.countries.includes(String(selected.country || ''))) return null;

  const { data, error } = await supabase
    .from('products')
    .select('id, name, country, data_amount, validity_days, price, description')
    .eq('is_active', true)
    .eq('country', selected.country)
    .eq('data_amount', selected.data_amount)
    .order('validity_days', { ascending: true })
    .order('price', { ascending: true });

  if (error || !data?.length) return null;

  const normalizedOptions = data.map(row => ({
    id: String(row.id),
    name: String(row.name || ''),
    country: String(row.country || ''),
    dataAmount: String(row.data_amount || '標準方案'),
    validityDays: Number(row.validity_days || 0),
    price: Number(row.price || 0),
    description: String(row.description || '').trim()
  })).filter(option => option.validityDays > 0 && option.price > 0);

  const seenDays = new Set<number>();
  const options = normalizedOptions.filter(option => {
    if (seenDays.has(option.validityDays)) return false;
    seenDays.add(option.validityDays);
    return true;
  });

  if (!options.length) return null;

  return {
    canonicalId: options[0].id,
    country: options[0].country,
    dataAmount: options[0].dataAmount,
    description: options.find(option => option.description)?.description || '',
    options
  };
}

export async function getPublicEsimPlanReviews(productIds: string[]): Promise<PublicEsimReviewSummary> {
  const empty = { averageRating: 0, averageSmoothness: 0, reviewCount: 0, reviews: [] };
  const ids = [...new Set(productIds.filter(Boolean))];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!ids.length || !url || !serviceRoleKey) return empty;

  const supabase = createClient(url, serviceRoleKey);
  const { data, error } = await supabase
    .from('product_reviews')
    .select('id, rating, smoothness_rating, comment, created_at')
    .in('product_id', ids)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error || !data) {
    console.error('Public eSIM reviews failed:', error?.message || 'No data');
    return empty;
  }

  const allReviews = data.map(review => ({
    id: String(review.id),
    rating: Number(review.rating),
    smoothnessRating: Number(review.smoothness_rating),
    comment: String(review.comment || '').trim(),
    createdAt: String(review.created_at)
  })).filter(review => review.rating >= 1 && review.rating <= 5 && review.comment.length > 0);
  if (!allReviews.length) return empty;

  return {
    averageRating: allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length,
    averageSmoothness: allReviews.reduce((sum, review) => sum + review.smoothnessRating, 0) / allReviews.length,
    reviewCount: allReviews.length,
    reviews: allReviews.slice(0, 12)
  };
}

export async function getActiveEsimPlanSitemapEntries(): Promise<EsimPlanSitemapEntry[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRoleKey) return [];

  const supabase = createClient(url, serviceRoleKey);
  const { data, error } = await supabase
    .from('products')
    .select('id, country, data_amount, validity_days, price, updated_at')
    .eq('is_active', true)
    .order('validity_days', { ascending: true })
    .order('price', { ascending: true })
    .limit(5000);

  if (error || !data) return [];

  const groups = new Map<string, EsimPlanSitemapEntry>();
  for (const row of data) {
    const country = String(row.country || '').trim();
    const dataAmount = String(row.data_amount || '').trim();
    if (!country || !dataAmount) continue;
    const key = `${country}\u0000${dataAmount}`;
    const updatedAt = row.updated_at ? String(row.updated_at) : null;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        id: String(row.id),
        country,
        updatedAt
      });
    } else if (updatedAt && (!existing.updatedAt || updatedAt > existing.updatedAt)) {
      existing.updatedAt = updatedAt;
    }
  }

  return [...groups.values()];
}
