
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

  useEffect(() => {
    async function fetchTransactions() {
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
    }

    fetchTransactions();
  }, []);

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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
