import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { EsimDestination } from '@/lib/esim-destinations';

export interface EsimSeoPlan {
  id: string;
  name: string;
  country: string;
  dataAmount: string;
  validityDays: number;
  price: number;
  description: string;
}

export interface EsimDestinationPlanSummary {
  planCount: number;
  lowestPrice: number | null;
  availableDays: number[];
  featureLabels: string[];
  plans: EsimSeoPlan[];
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
  const { data, error } = await supabase
    .from('products')
    .select('id, name, country, data_amount, validity_days, price, description')
    .eq('is_active', true)
    .in('country', destination.countries)
    .order('price', { ascending: true })
    .order('validity_days', { ascending: true })
    .limit(250);

  if (error || !data) {
    console.error(`SEO plans failed for ${destination.slug}:`, error?.message || 'No data');
    return { planCount: 0, lowestPrice: null, availableDays: [], featureLabels: [], plans: [] };
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

  const representativePlans: EsimSeoPlan[] = [];
  const seen = new Set<string>();
  for (const plan of normalized) {
    const key = `${plan.dataAmount}|${plan.validityDays}`;
    if (seen.has(key)) continue;
    seen.add(key);
    representativePlans.push(plan);
    if (representativePlans.length >= 12) break;
  }

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
