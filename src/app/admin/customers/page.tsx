"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Zap, User, PlusCircle } from "lucide-react";

// 模擬客戶資料
const MOCK_CUSTOMERS = [
  { id: "c1", email: "ben@example.com", name: "Ben Chen", token_balance: 500, created_at: "2026-05-01" },
  { id: "c2", email: "alice@example.com", name: "Alice", token_balance: 0, created_at: "2026-05-02" },
  { id: "c3", email: "bob@test.com", name: "Bob W.", token_balance: 1200, created_at: "2026-05-05" },
];

export default function AdminCustomersPage() {
  const [searchTerm, setSearchTerm] = useState("");
    const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setCustomers(data);
    }
  };
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [addAmount, setAddAmount] = useState("");
  const [reason, setReason] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const filteredCustomers = customers.filter(c => 
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2500);
  };

  const handleAddTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(addAmount);
    
    if (isNaN(amount) || amount === 0) {
      showToast("⚠️ 請輸入有效的調整金額 (不可為 0)");
      return;
    }

    if (!reason.trim()) {
      showToast("⚠️ 請填寫手動調整的原因");
      return;
    }

    if (!selectedCustomer) return;

    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          amount: amount,
          reason: reason
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        const errorMessage = result.error || '調整失敗，請檢查後台日誌。';
        alert(`發生錯誤:\n\n${errorMessage}`); // 使用強制 alert 彈窗
        throw new Error(errorMessage);
      }

      // 更新本地狀態
      const updatedCustomers = customers.map(c => 
        c.id === selectedCustomer.id 
          ? { ...c, token_balance: result.newBalance }
          : c
      );
      
      setCustomers(updatedCustomers);
      console.log(`[Log] ${selectedCustomer.email} 餘額變更: ${amount > 0 ? '+' : ''}${amount}. 原因: ${reason}`);
      showToast(`✅ 成功為 ${selectedCustomer.email} ${amount > 0 ? '加值' : '扣除'} NT${Math.abs(amount)}`);
      setSelectedCustomer(null);
      setAddAmount("");
      setReason("");
      
      // 再抓取一次最新資料確保同步
      fetchCustomers();
    } catch (err: any) {
      showToast("❌ " + err.message);
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black mb-2">會員管理與儲值</h1>
          <p className="text-muted text-sm md:text-base">查詢會員資料並手動加值/扣款 (Tokens)</p>
        </div>
      </div>

      <div className="bg-[#1A1A2E] md:bg-card-bg border border-white/10 rounded-2xl p-4 md:p-6 mb-8 shadow-xl">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
          <input 
            type="text" 
            placeholder="搜尋 Email 或姓名..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white outline-none focus:border-cyan transition-colors"
          />
        </div>

        {/* 電腦版表格視圖 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-muted">
                <th className="pb-3 px-4 font-medium">客戶資訊</th>
                <th className="pb-3 px-4 font-medium">目前儲值金餘額</th>
                <th className="pb-3 px-4 font-medium">註冊日期</th>
                <th className="pb-3 px-4 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => (
                <tr key={customer.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-muted shrink-0">
                        <User size={18} />
                      </div>
                      <div>
                        <div className="font-bold">{customer.email}</div>
                        <div className="text-sm text-muted">{customer.name || '未提供'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2 font-black text-yellow text-lg">
                      <Zap size={16} className="text-yellow" />
                      {customer.token_balance}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-muted">
                    {customer.created_at}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button 
                      onClick={() => setSelectedCustomer(customer)}
                      className="bg-cyan/20 text-cyan hover:bg-cyan/30 px-4 py-2 rounded-lg text-sm font-bold transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <PlusCircle size={16} />
                      手動調整餘額
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted">
                    找不到符合條件的客戶
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 手機版卡片視圖 */}
        <div className="md:hidden flex flex-col gap-4">
          {filteredCustomers.map(customer => (
            <div key={customer.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-muted shrink-0">
                    <User size={18} />
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-bold truncate">{customer.email}</div>
                    <div className="text-sm text-muted truncate">{customer.name || '未提供'}</div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg">
                <span className="text-sm text-muted">儲值金餘額</span>
                <div className="flex items-center gap-2 font-black text-yellow text-lg">
                  <Zap size={16} className="text-yellow" />
                  {customer.token_balance}
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted">註冊日: {customer.created_at}</span>
                <button 
                  onClick={() => setSelectedCustomer(customer)}
                  className="bg-cyan/20 text-cyan hover:bg-cyan/30 px-4 py-2 rounded-lg text-sm font-bold transition-colors inline-flex items-center gap-2"
                >
                  <PlusCircle size={16} />
                  調整餘額
                </button>
              </div>
            </div>
          ))}
          {filteredCustomers.length === 0 && (
            <div className="py-8 text-center text-muted">
              找不到符合條件的客戶
            </div>
          )}
        </div>
      </div>

      {/* 加值 Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-center items-center px-4">
          <div className="bg-[#1A1A2E] w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl relative border border-white/10 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => { setSelectedCustomer(null); setAddAmount(""); setReason(""); }} 
              className="absolute top-4 right-4 text-muted hover:text-white"
            >
              ✕
            </button>
            
            <h3 className="text-xl md:text-2xl font-black mb-6 pr-6">調整客戶餘額</h3>
            
            <div className="bg-black/30 p-4 rounded-xl mb-6">
              <div className="text-sm text-muted mb-1">客戶帳號</div>
              <div className="font-bold mb-3 break-all">{selectedCustomer.email}</div>
              <div className="text-sm text-muted mb-1">調整前餘額</div>
              <div className="font-black text-yellow">NT$ {selectedCustomer.token_balance}</div>
            </div>

            <form onSubmit={handleAddTokens}>
              <div className="mb-4">
                <label className="block text-sm text-muted mb-2">請輸入調整金額 (NT$)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    autoFocus
                    required
                    placeholder="例如 1000 (可負數)" 
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    className="w-full bg-[#0B0B1A] md:bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow text-xl font-bold" 
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs md:text-sm text-muted pointer-events-none">
                    正數加值 / 負數扣款
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm text-muted mb-2">手動調整原因 <span className="text-red-400">*必填</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="例如: 轉帳儲值、活動贈送..." 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-[#0B0B1A] md:bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan text-sm" 
                />
              </div>
              
              <button 
                type="submit" 
                className="w-full bg-gradient-to-r from-yellow to-[#f5d061] text-dark font-black py-4 rounded-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                <Zap size={20} />
                確認調整餘額
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 吐司通知 */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-dark px-6 py-3 rounded-full font-bold shadow-2xl z-[300] animate-fade-in-up whitespace-nowrap text-sm md:text-base">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
