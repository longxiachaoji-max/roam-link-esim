'use client';

import { useEffect, useState } from 'react';

interface PaymentLimits {
  credit_min: number;
  credit_max: number;
  barcode_min: number;
  barcode_max: number;
}

const DEFAULTS: PaymentLimits = {
  credit_min: 1,
  credit_max: 200000,
  barcode_min: 50,
  barcode_max: 20000
};

export default function PaymentLimitsPage() {
  const [limits, setLimits] = useState<PaymentLimits>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2600);
  };

  useEffect(() => {
    const fetchLimits = async () => {
      try {
        const res = await fetch('/api/admin/payment-limits');
        const json = await res.json();
        if (json.limits) setLimits(json.limits);
      } catch (error) {
        console.error('Error fetching payment limits:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLimits();
  }, []);

  const setAmount = (key: keyof PaymentLimits, value: string) => {
    setLimits({ ...limits, [key]: Math.max(0, Math.round(Number(value) || 0)) });
  };

  const handleSave = async () => {
    if (saving) return;
    if (limits.credit_max < limits.credit_min) {
      showToast('刷卡最高金額不可低於最低金額');
      return;
    }
    if (limits.barcode_max < limits.barcode_min) {
      showToast('超商條碼最高金額不可低於最低金額');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/payment-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(limits)
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '儲存失敗');
      setLimits(json.limits || limits);
      showToast('付款限制已儲存');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-white/50">載入中...</div>;
  }

  return (
    <div>
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-semibold text-white">付款限制</h1>
        <p className="text-sm text-white/40">設定前台結帳時各付款方式可接受的訂單金額。</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-white">刷卡 / Apple Pay</h2>
            <p className="text-sm text-white/40 mt-1">信用卡與 Apple Pay 共用這組金額限制。</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">最低金額</label>
              <div className="flex items-center rounded-lg border border-white/20 bg-black/40 focus-within:border-blue-500">
                <span className="pl-3 text-white/40 text-sm">NT$</span>
                <input
                  type="number"
                  min={0}
                  value={limits.credit_min}
                  onChange={(event) => setAmount('credit_min', event.target.value)}
                  className="w-full bg-transparent p-3 text-white outline-none sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">最高金額</label>
              <div className="flex items-center rounded-lg border border-white/20 bg-black/40 focus-within:border-blue-500">
                <span className="pl-3 text-white/40 text-sm">NT$</span>
                <input
                  type="number"
                  min={0}
                  value={limits.credit_max}
                  onChange={(event) => setAmount('credit_max', event.target.value)}
                  className="w-full bg-transparent p-3 text-white outline-none sm:text-sm"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-white">超商條碼</h2>
            <p className="text-sm text-white/40 mt-1">低於最低金額時，前台會禁止建立超商條碼訂單。</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">最低金額</label>
              <div className="flex items-center rounded-lg border border-white/20 bg-black/40 focus-within:border-blue-500">
                <span className="pl-3 text-white/40 text-sm">NT$</span>
                <input
                  type="number"
                  min={0}
                  value={limits.barcode_min}
                  onChange={(event) => setAmount('barcode_min', event.target.value)}
                  className="w-full bg-transparent p-3 text-white outline-none sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">最高金額</label>
              <div className="flex items-center rounded-lg border border-white/20 bg-black/40 focus-within:border-blue-500">
                <span className="pl-3 text-white/40 text-sm">NT$</span>
                <input
                  type="number"
                  min={0}
                  value={limits.barcode_max}
                  onChange={(event) => setAmount('barcode_max', event.target.value)}
                  className="w-full bg-transparent p-3 text-white outline-none sm:text-sm"
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6">
        <button
          onClick={() => setLimits(DEFAULTS)}
          className="px-4 py-2 border border-white/20 rounded-lg text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white transition-colors"
        >
          重置預設值
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 text-sm font-bold text-white shadow-lg"
        >
          {saving ? '儲存中...' : '儲存付款限制'}
        </button>
      </div>

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full font-bold shadow-2xl z-[300] animate-fade-in-up text-sm whitespace-nowrap">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
