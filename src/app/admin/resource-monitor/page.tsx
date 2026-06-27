'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Database, HardDrive, RefreshCw, Server, Table2 } from 'lucide-react';

interface TableUsage {
  name: string;
  label: string;
  rows: number;
  estimatedBytes: number;
  averageRowBytes: number;
  error?: string;
}

interface BucketUsage {
  id: string;
  name: string;
  public: boolean;
  objects: number;
  bytes: number;
}

interface CounterValue {
  total: number;
  today: number;
}

interface ResourceMonitorData {
  updatedAt: string;
  database: {
    estimatedBytes: number;
    tables: TableUsage[];
  };
  storage: {
    buckets: BucketUsage[];
    totalObjects: number;
    totalBytes: number;
    error?: string;
  };
  activity: {
    orders: {
      today: number;
      last7Days: number;
      last30Days: number;
    };
    traffic: {
      topupPageViews: CounterValue;
      roamlinkPageViews: CounterValue;
      topupToRoamlinkClicks: CounterValue;
    };
  };
  vercel: {
    deploymentUrl: string;
    productionUrl: string;
    environment: string;
    region: string;
    exactBandwidthAvailable: boolean;
    note: string;
  };
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('zh-TW');
}

export default function ResourceMonitorPage() {
  const [data, setData] = useState<ResourceMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMonitor = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/resource-monitor', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '無法載入資源監控');
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '無法載入資源監控');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMonitor();
  }, [loadMonitor]);

  const totalTrackedTraffic = useMemo(() => {
    if (!data) return 0;
    return data.activity.traffic.topupPageViews.total +
      data.activity.traffic.roamlinkPageViews.total +
      data.activity.traffic.topupToRoamlinkClicks.total;
  }, [data]);

  const cards = [
    {
      label: '資料庫估算',
      value: data ? formatBytes(data.database.estimatedBytes) : '—',
      detail: `${formatNumber(data?.database.tables.reduce((sum, table) => sum + table.rows, 0) || 0)} 筆資料`,
      icon: Database,
      color: 'text-cyan-300',
      bg: 'bg-cyan-400/10'
    },
    {
      label: 'Storage 檔案',
      value: data ? formatBytes(data.storage.totalBytes) : '—',
      detail: `${formatNumber(data?.storage.totalObjects || 0)} 個檔案`,
      icon: HardDrive,
      color: 'text-emerald-300',
      bg: 'bg-emerald-400/10'
    },
    {
      label: '站內流量計數',
      value: formatNumber(totalTrackedTraffic),
      detail: '頁面來訪與友站點擊',
      icon: Activity,
      color: 'text-rose-300',
      bg: 'bg-rose-400/10'
    },
    {
      label: 'Vercel 狀態',
      value: data?.vercel.environment || '—',
      detail: data?.vercel.region ? `Region ${data.vercel.region}` : 'Production',
      icon: Server,
      color: 'text-violet-300',
      bg: 'bg-violet-400/10'
    }
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">資源監控</h1>
          <p className="mt-2 text-sm text-white/40">查看資料庫、Storage、站內流量與 Vercel 部署狀態。</p>
        </div>
        <button
          type="button"
          onClick={() => void loadMonitor()}
          disabled={loading}
          className="flex h-10 items-center gap-2 border border-white/10 bg-white/5 px-4 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-40"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          重新整理
        </button>
      </div>

      {error && <div className="mb-6 border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <section key={card.label} className="border border-white/10 bg-[#151528] p-5">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-white">{card.label}</h2>
                  <p className="mt-1 text-xs text-white/35">{card.detail}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center ${card.bg} ${card.color}`}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="text-3xl font-black tabular-nums text-white">{loading ? '—' : card.value}</div>
            </section>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <section className="border border-white/10 bg-[#151528]">
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
            <Table2 size={18} className="text-cyan-300" />
            <h2 className="font-bold text-white">資料庫表格用量</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/[0.03]">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-white/40">資料表</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-white/40">筆數</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-white/40">估算大小</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-white/40">平均/筆</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {(data?.database.tables || []).map(table => (
                  <tr key={table.name}>
                    <td className="px-5 py-3">
                      <div className="text-sm font-bold text-white">{table.label}</div>
                      <div className="text-xs text-white/35">{table.error || table.name}</div>
                    </td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums text-white/70">{formatNumber(table.rows)}</td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums text-white/70">{formatBytes(table.estimatedBytes)}</td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums text-white/70">{formatBytes(table.averageRowBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="border border-white/10 bg-[#151528] p-5">
            <h2 className="font-bold text-white">站內流量</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-white/45">一飛通頁面來訪</span>
                <span className="font-bold tabular-nums text-cyan-300">{formatNumber(data?.activity.traffic.roamlinkPageViews.total || 0)}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-white/45">拾機儲值頁來訪</span>
                <span className="font-bold tabular-nums text-emerald-300">{formatNumber(data?.activity.traffic.topupPageViews.total || 0)}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-white/45">儲值頁前往漫遊</span>
                <span className="font-bold tabular-nums text-rose-300">{formatNumber(data?.activity.traffic.topupToRoamlinkClicks.total || 0)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="bg-white/[0.04] p-3">
                  <div className="text-xs text-white/35">24 小時訂單</div>
                  <div className="mt-1 text-lg font-black text-white">{formatNumber(data?.activity.orders.today || 0)}</div>
                </div>
                <div className="bg-white/[0.04] p-3">
                  <div className="text-xs text-white/35">7 天訂單</div>
                  <div className="mt-1 text-lg font-black text-white">{formatNumber(data?.activity.orders.last7Days || 0)}</div>
                </div>
                <div className="bg-white/[0.04] p-3">
                  <div className="text-xs text-white/35">30 天訂單</div>
                  <div className="mt-1 text-lg font-black text-white">{formatNumber(data?.activity.orders.last30Days || 0)}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="border border-white/10 bg-[#151528] p-5">
            <h2 className="font-bold text-white">Storage Buckets</h2>
            {data?.storage.error && <p className="mt-2 text-sm text-red-200">{data.storage.error}</p>}
            <div className="mt-4 space-y-3">
              {(data?.storage.buckets || []).length === 0 && <p className="text-sm text-white/35">目前沒有偵測到 Storage bucket。</p>}
              {(data?.storage.buckets || []).map(bucket => (
                <div key={bucket.id} className="border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-white">{bucket.name}</span>
                    <span className="text-xs text-white/35">{bucket.public ? 'Public' : 'Private'}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-white/45">
                    <span>{formatNumber(bucket.objects)} 個檔案</span>
                    <span>{formatBytes(bucket.bytes)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-white/10 bg-[#151528] p-5">
            <h2 className="font-bold text-white">Vercel</h2>
            <div className="mt-4 space-y-2 text-sm text-white/45">
              <div className="flex justify-between gap-4">
                <span>正式網址</span>
                <span className="max-w-[210px] truncate text-white/70">{data?.vercel.productionUrl || '—'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>部署網址</span>
                <span className="max-w-[210px] truncate text-white/70">{data?.vercel.deploymentUrl || '—'}</span>
              </div>
              <p className="pt-3 text-xs leading-5 text-yellow-100/70">{data?.vercel.note}</p>
            </div>
          </section>
        </div>
      </div>

      <p className="mt-6 text-xs leading-5 text-white/35">
        資料庫大小為依目前 API 可讀資料估算，適合觀察成長趨勢；Supabase Dashboard 的實際 Postgres size 仍會包含索引、系統資料與壓縮差異。
        {data?.updatedAt && <span className="ml-2">更新時間：{new Date(data.updatedAt).toLocaleString('zh-TW')}</span>}
      </p>
    </div>
  );
}
