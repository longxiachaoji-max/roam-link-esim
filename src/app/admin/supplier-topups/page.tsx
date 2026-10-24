'use client';

import { adminFetch } from '@/lib/admin-fetch';
import { rateOf, type SupplierTopup, type SupplierTopupSummary } from '@/lib/supplier-topups';
import type { MicroesimAccountBalance, MicroesimAccountTransaction } from '@/lib/microesim';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

const todayInTaipei = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

const emptyForm = () => ({ date: todayInTaipei(), twd: '', usd: '', balanceAfterUsd: '', note: '', microTransactionId: '' });

interface SupplierTopupsResponse {
  records?: SupplierTopup[];
  summary?: SupplierTopupSummary;
  microBalance?: MicroesimAccountBalance | null;
  microBalanceError?: string | null;
  microRecharges?: MicroesimAccountTransaction[];
  microRechargesError?: string | null;
  hkdPerUsd?: number;
  hkdPerUsdLive?: boolean;
}

const taipeiDate = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date(value));

const formatTwd = (value: number) => `NT$${Math.round(value).toLocaleString('zh-TW')}`;
const formatUsd = (value: number) => `US$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatRate = (value: number | null) => (value ? value.toFixed(2) : '-');

export default function SupplierTopupsPage() {
  const [records, setRecords] = useState<SupplierTopup[]>([]);
  const [summary, setSummary] = useState<SupplierTopupSummary | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [micro, setMicro] = useState<SupplierTopupsResponse>({});

  const applyResponse = (json: SupplierTopupsResponse) => {
    setRecords(json.records || []);
    setSummary(json.summary || null);
    // 新增／刪除的回應不含 Micro 即時資料，保留上次查到的
    if ('microBalance' in json || 'microRecharges' in json) setMicro(json);
  };

  const recordedMicroIds = new Set(records.map(record => record.microTransactionId).filter(Boolean));
  const hkdPerUsd = micro.hkdPerUsd || 7.8;

  // Micro 帳戶金額換成美金（帳戶是港幣時用當日匯率換算）
  const toUsd = (amount: number, currency: string) => (currency === 'HKD' ? amount / hkdPerUsd : amount);
  const formatMicroAmount = (amount: number, currency: string) => {
    if (currency === 'USD') return formatUsd(amount);
    const local = `${currency === 'HKD' ? 'HK$' : `${currency} `}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return currency === 'HKD' ? `${local} ≈ ${formatUsd(toUsd(amount, currency))}` : local;
  };

  const fillFromRecharge = (transaction: MicroesimAccountTransaction) => {
    setForm(current => ({
      ...current,
      date: taipeiDate(transaction.created_at),
      usd: toUsd(Number(transaction.amount), transaction.currency).toFixed(2),
      balanceAfterUsd: toUsd(Number(transaction.balance_after), transaction.currency).toFixed(2),
      note: transaction.currency === 'USD' ? current.note : `Micro 入帳 ${transaction.currency} ${Number(transaction.amount).toFixed(2)}`,
      microTransactionId: transaction.transaction_id
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    adminFetch('/api/admin/supplier-topups')
      .then(res => res.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        applyResponse(json);
      })
      .catch(err => setError(err instanceof Error ? err.message : '讀取失敗'))
      .finally(() => setLoading(false));
  }, []);

  const previewRate = Number(form.twd) > 0 && Number(form.usd) > 0 ? Number(form.twd) / Number(form.usd) : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/supplier-topups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '儲存失敗');
      applyResponse(json);
      setForm(emptyForm());
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: SupplierTopup) => {
    if (!window.confirm(`確定刪除 ${record.date} 這筆儲值紀錄嗎？\n${formatTwd(record.twd)} → ${formatUsd(record.usd)}`)) return;
    try {
      const res = await adminFetch(`/api/admin/supplier-topups?id=${encodeURIComponent(record.id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '刪除失敗');
      applyResponse(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗');
    }
  };

  const inputClass = 'mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-blue-500';

  if (loading) return <div className="text-white/50">載入中...</div>;

  return (
    <div className="text-white">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">廠商儲值紀錄</h1>
        <p className="text-sm text-white/40">記錄每次儲值到 MicroEsim 付了多少台幣、實際入帳多少美金，自動算出匯率。</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-xs text-emerald-200/70">Micro 目前餘額</p>
          {micro.microBalance ? (
            <>
              <p className="mt-1 text-xl font-bold text-emerald-100">
                {formatUsd(toUsd(Number(micro.microBalance.balance), micro.microBalance.currency))}
              </p>
              {micro.microBalance.currency !== 'USD' && (
                <p className="text-sm text-emerald-100/70">{micro.microBalance.currency === 'HKD' ? 'HK$' : `${micro.microBalance.currency} `}{Number(micro.microBalance.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              )}
              <p className="mt-1 text-[11px] text-emerald-200/50">
                即時查詢 MicroEsim{micro.microBalance.currency === 'HKD' && `・1 美金 = ${hkdPerUsd.toFixed(3)} 港幣${micro.hkdPerUsdLive ? '' : '（估計）'}`}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-xl font-bold text-emerald-100">{summary?.latestBalanceUsd !== null && summary?.latestBalanceUsd !== undefined ? formatUsd(summary.latestBalanceUsd) : '-'}</p>
              <p className="mt-1 text-[11px] text-amber-200/70">{micro.microBalanceError ? `即時查詢失敗，顯示手動記錄` : summary?.latestBalanceDate ? `${summary.latestBalanceDate} 儲值後（手動記錄）` : '尚無資料'}</p>
            </>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/50">最近一次匯率</p>
          <p className="mt-1 text-xl font-bold">{formatRate(summary?.latestRate ?? null)}</p>
          <p className="mt-1 text-[11px] text-white/35">每 1 美金花的台幣</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/50">平均匯率</p>
          <p className="mt-1 text-xl font-bold">{formatRate(summary?.averageRate ?? null)}</p>
          <p className="mt-1 text-[11px] text-white/35">累計台幣 ÷ 累計美金</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/50">累計儲值（{summary?.count || 0} 筆）</p>
          <p className="mt-1 text-lg font-bold">{formatTwd(summary?.totalTwd || 0)}</p>
          <p className="text-sm text-white/60">{formatUsd(summary?.totalUsd || 0)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-4 text-lg font-bold">新增一筆儲值</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-sm text-white/70">
            儲值日期
            <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputClass} />
          </label>
          <label className="block text-sm text-white/70">
            付出台幣
            <input required inputMode="numeric" value={form.twd} onChange={e => setForm({ ...form, twd: e.target.value })} placeholder="1000" className={inputClass} />
          </label>
          <label className="block text-sm text-white/70">
            入帳美金
            <input required inputMode="decimal" value={form.usd} onChange={e => setForm({ ...form, usd: e.target.value })} placeholder="27.83" className={inputClass} />
          </label>
          <label className="block text-sm text-white/70">
            儲值後 Micro 餘額（選填）
            <input inputMode="decimal" value={form.balanceAfterUsd} onChange={e => setForm({ ...form, balanceAfterUsd: e.target.value })} placeholder="美金" className={inputClass} />
          </label>
          <label className="block text-sm text-white/70">
            備註（選填）
            <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="例如：轉帳方式" className={inputClass} />
          </label>
        </div>
        {form.microTransactionId && (
          <p className="mt-3 text-xs text-emerald-200/70">已從 Micro 入帳紀錄帶入美金與餘額，只要填付出的台幣。<button type="button" onClick={() => setForm(current => ({ ...current, microTransactionId: '' }))} className="ml-2 underline">取消關聯</button></p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-white/60">
            這筆匯率：<span className="font-bold text-white">{formatRate(previewRate)}</span>
            {previewRate && <span className="text-white/40">（1 美金 ≈ {previewRate.toFixed(2)} 台幣）</span>}
          </p>
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:bg-gray-600">
            {saving ? '儲存中...' : '儲存'}
          </button>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      </form>

      <section className="mb-6 rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-bold">Micro 近 30 天入帳</h2>
        <p className="mb-3 mt-1 text-xs text-white/40">直接從 MicroEsim 查詢（帳戶以港幣計價，美金依當日匯率換算）。按「帶入」會把換算後的美金和儲值後餘額填進上面的表單，你只要填付出的台幣。</p>
        {micro.microRechargesError && <p className="text-sm text-amber-200/80">查詢失敗：{micro.microRechargesError}</p>}
        {!micro.microRechargesError && (micro.microRecharges || []).length === 0 && <p className="text-sm text-white/40">近 30 天沒有入帳紀錄</p>}
        <div className="space-y-2">
          {(micro.microRecharges || []).map(transaction => {
            const recorded = recordedMicroIds.has(transaction.transaction_id);
            return (
              <div key={transaction.transaction_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <div>
                  <p className="font-mono text-white/80">{taipeiDate(transaction.created_at)}</p>
                  <p className="text-xs text-white/40">{transaction.description || '儲值入帳'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">+{formatMicroAmount(Number(transaction.amount), transaction.currency)}</p>
                  <p className="text-xs text-white/40">入帳後餘額 {formatMicroAmount(Number(transaction.balance_after), transaction.currency)}</p>
                </div>
                {recorded ? (
                  <span className="rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">已記錄</span>
                ) : (
                  <button type="button" onClick={() => fillFromRecharge(transaction)} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500">帶入</button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium">日期</th>
              <th className="px-4 py-3 text-right font-medium">台幣</th>
              <th className="px-4 py-3 text-right font-medium">美金</th>
              <th className="px-4 py-3 text-right font-medium">匯率</th>
              <th className="px-4 py-3 text-right font-medium">儲值後餘額</th>
              <th className="px-4 py-3 font-medium">備註</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-white/40">還沒有儲值紀錄</td></tr>
            )}
            {records.map(record => (
              <tr key={record.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 font-mono text-white/80">{record.date}</td>
                <td className="px-4 py-3 text-right">{formatTwd(record.twd)}</td>
                <td className="px-4 py-3 text-right">{formatUsd(record.usd)}</td>
                <td className="px-4 py-3 text-right font-bold">{formatRate(rateOf(record))}</td>
                <td className="px-4 py-3 text-right text-white/70">{record.balanceAfterUsd !== null ? formatUsd(record.balanceAfterUsd) : '-'}</td>
                <td className="px-4 py-3 text-white/60">{record.note || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => handleDelete(record)} aria-label="刪除" className="rounded-md p-2 text-white/40 hover:bg-red-500/10 hover:text-red-300">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
