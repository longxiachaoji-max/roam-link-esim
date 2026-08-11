
'use client';

import { useState, useEffect } from 'react';
import { ArrowDownRight, ArrowUpRight, ReceiptText, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

interface Transaction {
  id: string;
  customer_id: string;
  amount: number;
  transaction_type?: 'topup' | 'purchase';
  created_at: string;
  reason: string;
  balance_after: number;
}

function getTransactionDisplay(tx: Transaction) {
  const amount = Number(tx.amount || 0);
  const isDebit = tx.transaction_type === 'purchase' || amount < 0;

  return {
    label: isDebit ? '消費' : '儲值',
    sign: isDebit ? '-' : '+',
    amount: Math.abs(amount),
    badgeClass: isDebit
      ? 'border-rose-400/25 bg-rose-400/10 text-rose-300'
      : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    amountClass: isDebit ? 'text-rose-300' : 'text-emerald-300',
    Icon: isDebit ? ArrowUpRight : ArrowDownRight,
  } as const;
}

function formatMoney(value: number) {
  return `NT$ ${Number(value || 0).toLocaleString('zh-TW')}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MemberHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      } else {
        setError('請先登入會員後查看消費紀錄。');
        setLoading(false);
      }
    }
    getUser();
  }, []);

  useEffect(() => {
    if (!userEmail) return;

    async function fetchTransactions() {
      try {
        const response = await authenticatedFetch('/api/member/topup-history');
        if (!response.ok) {
          throw new Error('無法載入消費紀錄，請稍後再試。');
        }
        const data = await response.json();
        setTransactions(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '無法載入消費紀錄，請稍後再試。');
      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();
  }, [userEmail]);

  if (loading) {
    return <div className="grid min-h-dvh place-items-center bg-[#0a0a0c] p-8 text-center text-white/60">消費紀錄載入中...</div>;
  }

  if (error) {
    return <div className="grid min-h-dvh place-items-center bg-[#0a0a0c] p-8 text-center text-rose-300">{error}</div>;
  }

  return (
    <main className="min-h-dvh bg-[#0a0a0c] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6 sm:pt-10 lg:px-8">
        <header className="mb-6 flex items-start justify-between gap-4 sm:mb-8">
          <div>
            <p className="mb-1 text-sm font-semibold text-[#F05A28]">會員中心</p>
            <h1 className="text-2xl font-bold sm:text-3xl">消費紀錄</h1>
            <p className="mt-2 text-sm text-white/45">共 {transactions.length} 筆儲值金異動</p>
          </div>
          <button
            type="button"
            onClick={() => window.history.back()}
            aria-label="返回會員中心"
            title="返回會員中心"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-white/65 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </header>

        {transactions.length === 0 ? (
          <div className="border-y border-white/10 py-16 text-center">
            <ReceiptText className="mx-auto mb-3 text-white/20" size={38} />
            <p className="font-semibold text-white/65">目前沒有消費紀錄</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {transactions.map((tx) => {
                const display = getTransactionDisplay(tx);
                const Icon = display.Icon;

                return (
                  <article key={tx.id} className="rounded-md border border-white/10 bg-[#17171f] p-4 shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${display.badgeClass}`}>
                          <Icon size={13} />
                          {display.label}
                        </span>
                        <p className="mt-3 break-words text-sm font-semibold leading-6 text-white/85">{tx.reason || '儲值金異動'}</p>
                      </div>
                      <p className={`shrink-0 text-base font-bold ${display.amountClass}`}>
                        {display.sign}{formatMoney(display.amount)}
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-white/8 pt-3 text-xs">
                      <div>
                        <p className="text-white/35">交易時間</p>
                        <p className="mt-1 leading-5 text-white/60">{formatDate(tx.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/35">交易後餘額</p>
                        <p className="mt-1 font-semibold leading-5 text-white/75">{formatMoney(tx.balance_after)}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-hidden rounded-md border border-white/10 bg-[#17171f] shadow-xl md:block">
              <table className="w-full table-fixed text-left">
                <thead className="border-b border-white/10 bg-white/5 text-xs font-semibold text-white/45">
                  <tr>
                    <th className="w-44 px-5 py-4">交易時間</th>
                    <th className="px-5 py-4">項目</th>
                    <th className="w-40 px-5 py-4 text-right">異動金額</th>
                    <th className="w-40 px-5 py-4 text-right">交易後餘額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {transactions.map((tx) => {
                    const display = getTransactionDisplay(tx);
                    const Icon = display.Icon;

                    return (
                      <tr key={tx.id} className="transition-colors hover:bg-white/[0.025]">
                        <td className="px-5 py-4 text-sm text-white/45">{formatDate(tx.created_at)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${display.badgeClass}`}>
                              <Icon size={13} />
                              {display.label}
                            </span>
                            <span className="min-w-0 break-words text-sm leading-6 text-white/80">{tx.reason || '儲值金異動'}</span>
                          </div>
                        </td>
                        <td className={`px-5 py-4 text-right text-sm font-bold ${display.amountClass}`}>
                          {display.sign}{formatMoney(display.amount)}
                        </td>
                        <td className="px-5 py-4 text-right text-sm font-semibold text-white/65">{formatMoney(tx.balance_after)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
