"use client";

import { useCallback, useEffect, useState } from 'react';
import { Globe2, MonitorUp, MousePointerClick, RefreshCw } from 'lucide-react';

interface CounterValue {
  total: number;
  today: number;
}

interface AnalyticsMetrics {
  topupPageViews: CounterValue;
  roamlinkPageViews: CounterValue;
  topupToRoamlinkClicks: CounterValue;
}

const EMPTY_METRICS: AnalyticsMetrics = {
  topupPageViews: { total: 0, today: 0 },
  roamlinkPageViews: { total: 0, today: 0 },
  topupToRoamlinkClicks: { total: 0, today: 0 }
};

export default function AdminAnalyticsPage() {
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/analytics', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '無法載入流量統計');
      setMetrics(result.metrics);
      setUpdatedAt(result.updatedAt);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '無法載入流量統計');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const counters = [
    {
      label: '拾機儲值頁來訪',
      description: 'pay.firstesim.space',
      value: metrics.topupPageViews,
      icon: MonitorUp,
      accent: 'text-emerald-300',
      iconBackground: 'bg-emerald-400/10'
    },
    {
      label: '一飛通頁面來訪',
      description: 'firstesim.space',
      value: metrics.roamlinkPageViews,
      icon: Globe2,
      accent: 'text-cyan-300',
      iconBackground: 'bg-cyan-400/10'
    },
    {
      label: '儲值頁前往漫遊',
      description: '友站連結點擊次數',
      value: metrics.topupToRoamlinkClicks,
      icon: MousePointerClick,
      accent: 'text-rose-300',
      iconBackground: 'bg-rose-400/10'
    }
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">流量統計</h1>
          <p className="mt-2 text-sm text-white/40">查看拾機儲值頁、一飛通首頁與友站連結的累計數字</p>
        </div>
        <button
          type="button"
          onClick={() => void loadAnalytics()}
          disabled={loading}
          className="flex h-10 items-center gap-2 border border-white/10 bg-white/5 px-4 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-40"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          重新整理
        </button>
      </div>

      {error && <div className="mb-6 border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        {counters.map(counter => {
          const Icon = counter.icon;
          return (
            <section key={counter.label} className="border border-white/10 bg-[#151528] p-5">
              <div className="mb-7 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-white">{counter.label}</h2>
                  <p className="mt-1 text-xs text-white/35">{counter.description}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center ${counter.iconBackground} ${counter.accent}`}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="text-4xl font-black tabular-nums text-white">{loading ? '—' : counter.value.total.toLocaleString()}</div>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                <span className="text-white/40">今日</span>
                <span className={`font-bold tabular-nums ${counter.accent}`}>{loading ? '—' : counter.value.today.toLocaleString()}</span>
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-6 border-t border-white/10 pt-4 text-xs leading-5 text-white/35">
        每個瀏覽器工作階段的頁面來訪計算一次；友站連結每次點擊都會計入。統計不會記錄會員姓名、Email 或 IP。
        {updatedAt && <span className="ml-2">更新時間：{new Date(updatedAt).toLocaleString('zh-TW')}</span>}
      </div>
    </div>
  );
}
