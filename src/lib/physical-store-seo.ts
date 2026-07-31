import 'server-only';
import { createClient } from '@supabase/supabase-js';

export interface PhysicalProductSitemapEntry {
  id: string;
  category: string;
  updatedAt: string | null;
}

export async function getActivePhysicalProductSitemapEntries(): Promise<PhysicalProductSitemapEntry[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRoleKey) return [];

  const supabase = createClient(url, serviceRoleKey);
  const { data, error } = await supabase
    .from('physical_products')
    .select('id, category, updated_at')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1000);

  if (error || !data) {
    console.error('Active physical product sitemap entries failed:', error?.message || 'No data');
    return [];
  }

  return data
    .map(row => ({
      id: String(row.id || '').trim(),
      category: String(row.category || '').trim(),
      updatedAt: row.updated_at ? String(row.updated_at) : null
    }))
    .filter(product => product.id.length > 0);
}
