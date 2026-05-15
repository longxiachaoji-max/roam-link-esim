"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Search, History } from "lucide-react";

export default function TopupHistoryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      // 透過後端 API 抓取資料（繞過 RLS），以確保管理員能看到所有紀錄
      const res = await fetch('/api/admin/topup-history');
      const json = await res.json();
      
      if (res.ok && json.transactions) {
        setTransactions(json.transactions);
      } else {
        console.error("Fetch transactions error:", json.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTxs = transactions.filter(tx => 
    tx.customers?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black mb-2 flex items-center gap-2">
            <History className="text-cyan" /> 儲值紀錄
          </h1>
          <p className="text-muted text-sm md:text-base">查看所有會員的儲值與扣款明細</p>
        </div>
        <button 
          onClick={fetchTransactions}
          className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm transition"
        >
          重新整理
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="搜尋 Email 或備註..." 
              className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-2 md:py-3 text-sm md:text-base focus:outline-none focus:border-cyan transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400">載入中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs md:text-sm">
                  <th className="pb-3 px-2 md:px-4 font-medium">時間</th>
                  <th className="pb-3 px-2 md:px-4 font-medium">帳號 (Email)</th>
                  <th className="pb-3 px-2 md:px-4 font-medium">變動金額</th>
                  <th className="pb-3 px-2 md:px-4 font-medium">變動後餘額</th>
                  <th className="pb-3 px-2 md:px-4 font-medium">備註 (原因)</th>
                </tr>
              </thead>
              <tbody className="text-sm md:text-base">
                {filteredTxs.length > 0 ? (
                  filteredTxs.map((tx) => (
                    <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="py-3 md:py-4 px-2 md:px-4 text-gray-300">
                        {new Date(tx.created_at).toLocaleString('zh-TW', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 md:py-4 px-2 md:px-4">
                        <div className="font-medium">{tx.customers?.name || 'Unknown'}</div>
                        <div className="text-xs text-gray-400">{tx.customers?.email}</div>
                      </td>
                      <td className="py-3 md:py-4 px-2 md:px-4">
                        <span className={`font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount} Tokens
                        </span>
                      </td>
                      <td className="py-3 md:py-4 px-2 md:px-4 text-cyan font-medium">
                        {tx.balance_after !== null && tx.balance_after !== undefined ? `${tx.balance_after} Tokens` : '-'}
                      </td>
                      <td className="py-3 md:py-4 px-2 md:px-4 text-gray-300">
                        {tx.reason || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">
                      沒有找到符合的儲值紀錄
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
