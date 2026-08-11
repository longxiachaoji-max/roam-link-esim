
'use client';

import { adminFetch } from '@/lib/admin-fetch';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Check, Copy, Pencil, Search } from 'lucide-react';

interface Transaction {
  id: string;
  customer_id: string;
  amount: number;
  transaction_type?: 'topup' | 'purchase';
  reason?: string | null;
  created_at: string;
  customers: {
    email: string;
  } | null;
}

const RECEIVED_AMOUNT_PATTERN = /\[收款金額:(\d+(?:\.\d+)?)\]\s*/;

function getReceivedAmount(tx: Transaction) {
  const match = (tx.reason || '').match(RECEIVED_AMOUNT_PATTERN);
  if (match) return Number(match[1] || 0);

  const amount = Number(tx.amount || 0);
  if (tx.transaction_type === 'purchase' || amount <= 0) return 0;
  if ((tx.reason || '').includes('兌換代碼')) return 0;
  return amount;
}

function getCleanReason(tx: Transaction) {
  return (tx.reason || '').replace(RECEIVED_AMOUNT_PATTERN, '').trim() || '-';
}

function getTransactionDisplay(tx: Transaction) {
  const amount = Number(tx.amount || 0);
  const isDebit = tx.transaction_type === 'purchase' || amount < 0;

  return {
    label: isDebit ? '消費' : '儲值',
    sign: isDebit ? '-' : '+',
    amount: Math.abs(amount),
    badgeVariant: isDebit ? 'destructive' : 'default',
    amountClass: isDebit ? 'text-red-400' : 'text-emerald-400',
  } as const;
}

export default function TopupHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [receivedAmountInput, setReceivedAmountInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'topup' | 'purchase'>('all');
  const [copiedId, setCopiedId] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchTransactions = async () => {
    try {
      const response = await adminFetch('/api/admin/topup-history');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      setTransactions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTransactions = transactions.filter((tx) => {
    const display = getTransactionDisplay(tx);
    if (typeFilter !== 'all' && display.label !== (typeFilter === 'topup' ? '儲值' : '消費')) return false;

    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [tx.id, tx.customers?.email, getCleanReason(tx)]
      .some((value) => String(value || '').toLowerCase().includes(query));
  });

  const copyTransactionId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 1800);
    } catch {
      showToast('無法複製交易編號');
    }
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTransaction(tx);
    setReceivedAmountInput(String(getReceivedAmount(tx)));
  };

  const closeEditModal = () => {
    setEditingTransaction(null);
    setReceivedAmountInput('');
  };

  const saveReceivedAmount = async () => {
    if (!editingTransaction || saving) return;

    const amount = Number(receivedAmountInput);
    if (!Number.isFinite(amount) || amount < 0) {
      showToast('請輸入有效的收到款項');
      return;
    }

    setSaving(true);
    try {
      const response = await adminFetch('/api/admin/topup-history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTransaction.id,
          receivedAmount: amount
        })
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || '更新失敗');

      showToast('收到款項已更新');
      closeEditModal();
      await fetchTransactions();
    } catch (err: any) {
      showToast(err.message || '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-white/55">正在載入儲值紀錄...</div>;
  }

  if (error) {
    return <div className="py-16 text-center text-red-400">載入失敗：{error}</div>;
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">儲值與消費紀錄</h1>
          <p className="mt-1 text-sm text-white/45">共 {filteredTransactions.length} 筆紀錄</p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <div className="flex h-11 items-center border border-white/10 bg-white/5 px-3 sm:w-72">
            <Search size={17} className="mr-2 shrink-0 text-white/35" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜尋會員、原因或交易編號"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            />
          </div>
          <div className="grid h-11 grid-cols-3 border border-white/10 bg-white/5 p-1 text-sm">
            {([
              ['all', '全部'],
              ['topup', '儲值'],
              ['purchase', '消費'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTypeFilter(value)}
                className={`min-w-16 px-3 font-bold transition-colors ${typeFilter === value ? 'bg-cyan text-[#0B0B1A]' : 'text-white/55 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="border border-white/10 bg-white/5 py-16 text-center text-sm text-white/45">
          找不到符合條件的紀錄
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden border border-white/10 bg-[#151525] shadow-lg md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-white">
                <thead className="bg-white/[0.06]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/45">會員與交易編號</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/45">類型</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-white/45">異動金額</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-white/45">收到款項</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/45">原因</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/45">時間</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-white/45">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {filteredTransactions.map((tx) => {
                    const display = getTransactionDisplay(tx);

                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-4">
                          <div className="max-w-56 truncate text-sm font-medium">{tx.customers?.email || '無會員信箱'}</div>
                          <button
                            onClick={() => copyTransactionId(tx.id)}
                            title="複製完整交易編號"
                            className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-white/35 hover:text-cyan"
                          >
                            {tx.id.slice(0, 8)}...{tx.id.slice(-4)}
                            {copiedId === tx.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Badge variant={display.badgeVariant}>{display.label}</Badge>
                        </td>
                        <td className={`px-4 py-4 whitespace-nowrap text-right text-sm font-bold ${display.amountClass}`}>
                          {display.sign} NT$ {display.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-bold text-emerald-300">
                          NT$ {getReceivedAmount(tx).toLocaleString()}
                        </td>
                        <td className="max-w-72 px-4 py-4 text-sm leading-5 text-white/65">
                          {getCleanReason(tx)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-white/45">
                          {new Date(tx.created_at).toLocaleString('zh-TW')}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => openEditModal(tx)}
                            title="修改收到款項"
                            className="inline-flex h-9 w-9 items-center justify-center border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                          >
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 md:hidden">
            {filteredTransactions.map((tx) => {
              const display = getTransactionDisplay(tx);

              return (
                <article key={tx.id} className="border border-white/10 bg-[#151525] p-4 shadow-lg">
                  <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">{tx.customers?.email || '無會員信箱'}</div>
                      <div className="mt-1 text-xs text-white/40">{new Date(tx.created_at).toLocaleString('zh-TW')}</div>
                    </div>
                    <Badge variant={display.badgeVariant}>{display.label}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-4">
                    <div>
                      <div className="text-xs text-white/35">異動金額</div>
                      <div className={`mt-1 text-lg font-black ${display.amountClass}`}>
                        {display.sign} NT$ {display.amount.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/35">收到款項</div>
                      <div className="mt-1 text-lg font-black text-emerald-300">NT$ {getReceivedAmount(tx).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="border-t border-white/[0.07] pt-3">
                    <div className="text-xs text-white/35">原因</div>
                    <p className="mt-1 break-words text-sm leading-6 text-white/70">{getCleanReason(tx)}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      onClick={() => copyTransactionId(tx.id)}
                      className="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs text-white/35 hover:text-cyan"
                    >
                      <span className="truncate">{tx.id.slice(0, 8)}...{tx.id.slice(-4)}</span>
                      {copiedId === tx.id ? <Check size={14} className="shrink-0" /> : <Copy size={14} className="shrink-0" />}
                    </button>
                    <button
                      onClick={() => openEditModal(tx)}
                      className="inline-flex shrink-0 items-center gap-2 border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
                    >
                      <Pencil size={14} />
                      修改收款
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {editingTransaction && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-[#1A1A2E] p-5 shadow-2xl sm:p-6">
            <h2 className="text-xl font-black text-white mb-2">修改收到款項</h2>
            <p className="text-sm text-white/50 mb-5">
              只會影響營收/毛利統計，不會改會員餘額。
            </p>

            <div className="mb-4 rounded-md bg-black/30 p-3 text-sm text-white/70">
              <div>{editingTransaction.customers?.email || 'N/A'}</div>
              <div className="mt-1 text-white/40">{getCleanReason(editingTransaction)}</div>
            </div>

            <label className="block text-sm text-white/60 mb-2">收到款項 NT$</label>
            <input
              type="number"
              min="0"
              autoFocus
              value={receivedAmountInput}
              onChange={(e) => setReceivedAmountInput(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 px-4 py-3 text-xl font-bold text-white outline-none focus:border-emerald-400"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeEditModal}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/5"
              >
                取消
              </button>
              <button
                onClick={saveReceivedAmount}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-300"
              >
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full font-bold shadow-2xl z-[300] text-sm whitespace-nowrap">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
