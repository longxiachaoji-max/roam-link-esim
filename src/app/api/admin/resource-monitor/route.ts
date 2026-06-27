import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseTrafficAnalytics } from '@/lib/traffic-analytics';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES = [
  { name: 'customers', label: '會員' },
  { name: 'orders', label: '訂單' },
  { name: 'order_items', label: '訂單明細' },
  { name: 'products', label: '商品' },
  { name: 'e_sim_inventory', label: 'eSIM 庫存' },
  { name: 'token_transactions', label: '儲值異動' },
  { name: 'promo_codes', label: '優惠代碼' },
  { name: 'site_settings', label: '網站設定' }
];

function byteLength(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value || ''), 'utf8');
}

async function getTableUsage(table: { name: string; label: string }) {
  const countPromise = supabase
    .from(table.name)
    .select('*', { count: 'exact', head: true });
  const samplePromise = supabase
    .from(table.name)
    .select('*')
    .limit(100);

  const [{ count, error: countError }, { data, error: sampleError }] = await Promise.all([countPromise, samplePromise]);
  if (countError || sampleError) {
    return {
      ...table,
      rows: 0,
      estimatedBytes: 0,
      averageRowBytes: 0,
      error: countError?.message || sampleError?.message || '讀取失敗'
    };
  }

  const sampleRows = data || [];
  const sampleBytes = byteLength(sampleRows);
  const averageRowBytes = sampleRows.length ? Math.ceil(sampleBytes / sampleRows.length) : 0;
  const rows = count || 0;

  return {
    ...table,
    rows,
    estimatedBytes: averageRowBytes * rows,
    averageRowBytes
  };
}

async function listStorageFolder(bucket: string, path = ''): Promise<{ objects: number; bytes: number }> {
  const { data, error } = await supabase.storage.from(bucket).list(path, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error || !data) return { objects: 0, bytes: 0 };

  let objects = 0;
  let bytes = 0;
  for (const item of data) {
    const itemPath = path ? `${path}/${item.name}` : item.name;
    if (item.id || item.metadata?.size !== undefined) {
      objects += 1;
      bytes += Number(item.metadata?.size || 0);
    } else {
      const nested = await listStorageFolder(bucket, itemPath);
      objects += nested.objects;
      bytes += nested.bytes;
    }
  }

  return { objects, bytes };
}

async function getStorageUsage() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error || !buckets) return { buckets: [], totalObjects: 0, totalBytes: 0, error: error?.message };

  const bucketUsage = [];
  for (const bucket of buckets) {
    const usage = await listStorageFolder(bucket.name);
    bucketUsage.push({
      id: bucket.id,
      name: bucket.name,
      public: bucket.public,
      ...usage
    });
  }

  return {
    buckets: bucketUsage,
    totalObjects: bucketUsage.reduce((sum, bucket) => sum + bucket.objects, 0),
    totalBytes: bucketUsage.reduce((sum, bucket) => sum + bucket.bytes, 0)
  };
}

async function getOrderWindows() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const ranges = [
    { key: 'today', since: new Date(now - day).toISOString() },
    { key: 'last7Days', since: new Date(now - 7 * day).toISOString() },
    { key: 'last30Days', since: new Date(now - 30 * day).toISOString() }
  ];

  const result: Record<string, number> = {};
  for (const range of ranges) {
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', range.since);
    result[range.key] = count || 0;
  }
  return result;
}

export async function GET() {
  try {
    const [{ data: settings }, tables, storage, orderWindows] = await Promise.all([
      supabase.from('site_settings').select('usage_guide').eq('id', 'main').single(),
      Promise.all(TABLES.map(getTableUsage)),
      getStorageUsage(),
      getOrderWindows()
    ]);

    const databaseEstimatedBytes = tables.reduce((sum, table) => sum + table.estimatedBytes, 0);
    const traffic = parseTrafficAnalytics(settings?.usage_guide || '').counters;

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      database: {
        estimatedBytes: databaseEstimatedBytes,
        tables
      },
      storage,
      activity: {
        orders: orderWindows,
        traffic: {
          topupPageViews: traffic.topup_page_view,
          roamlinkPageViews: traffic.roamlink_page_view,
          topupToRoamlinkClicks: traffic.topup_to_roamlink_click
        }
      },
      vercel: {
        projectName: process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'roma-link-esim' : 'roma-link-esim',
        deploymentUrl: process.env.VERCEL_URL || '',
        productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.NEXT_PUBLIC_SITE_URL || '',
        environment: process.env.VERCEL_ENV || 'production',
        region: process.env.VERCEL_REGION || '',
        exactBandwidthAvailable: false,
        note: '目前未設定 Vercel Usage API token，因此無法在站內讀取精準帶寬 GB；可先用站內流量與資料庫估算監控。'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '無法載入資源監控' }, { status: 500 });
  }
}
