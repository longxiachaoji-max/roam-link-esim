
'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase'; // Using the client-side client

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
    label: isDebit ? 'Purchase' : 'Top-up',
    sign: isDebit ? '-' : '+',
    amount: Math.abs(amount),
    badgeVariant: isDebit ? 'destructive' : 'default',
    amountClass: isDebit ? 'text-red-400' : 'text-emerald-400',
  } as const;
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
        setError('You must be logged in to view this page.');
        setLoading(false);
      }
    }
    getUser();
  }, []);

  useEffect(() => {
    if (!userEmail) return;

    async function fetchTransactions() {
      try {
        const response = await fetch(`/api/member/topup-history?email=${encodeURIComponent(userEmail!)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch your transaction history');
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
  }, [userEmail]);

  if (loading) {
    return <div className="p-8 text-center text-white">Loading your history...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-400">Error: {error}</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto relative">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">消費紀錄 (Transaction History)</h1>
        <button 
          onClick={() => window.history.back()} 
          className="bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-white">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Balance</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-400">You have no transactions yet.</td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const display = getTransactionDisplay(tx);

                  return (
                    <tr key={tx.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                           <Badge variant={display.badgeVariant}>
                             {display.label}
                           </Badge>
                           <span>{tx.reason}</span>
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${display.amountClass}`}>
                         {display.sign}{display.amount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {tx.balance_after}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
