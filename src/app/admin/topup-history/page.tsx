
'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

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
    label: isDebit ? 'purchase' : 'topup',
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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/admin/topup-history');
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
      const response = await fetch('/api/admin/topup-history', {
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
    return <div className="p-8 text-center">Loading transaction history...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-white">All Top-up & Purchase History</h1>
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-white">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Transaction ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">User Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">收到款項</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {transactions.map((tx) => {
                const display = getTransactionDisplay(tx);

                return (
                  <tr key={tx.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-400">{tx.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{tx.customers?.email || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={display.badgeVariant}>
                        {display.label}
                      </Badge>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${display.amountClass}`}>
                      {display.sign}{display.amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-400">
                      NT$ {getReceivedAmount(tx).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {getCleanReason(tx)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => openEditModal(tx)}
                        className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/10"
                      >
                        修改收款
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingTransaction && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A1A2E] p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white mb-2">修改收到款項</h2>
            <p className="text-sm text-white/50 mb-5">
              只會影響營收/毛利統計，不會改會員餘額。
            </p>

            <div className="mb-4 rounded-xl bg-black/30 p-3 text-sm text-white/70">
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
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xl font-bold text-white outline-none focus:border-emerald-400"
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
