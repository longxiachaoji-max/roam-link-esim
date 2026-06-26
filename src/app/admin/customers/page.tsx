"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Zap, User, PlusCircle, TicketPercent } from "lucide-react";

export default function AdminCustomersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [referralConfig, setReferralConfig] = useState<any>(null);

  useEffect(() => {
    fetchCustomers();
    fetchReferralConfig();
  }, []);

  const fetchCustomers = async () => {
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setCustomers(data);
    }
  };
  const fetchReferralConfig = async () => {
    const res = await fetch('/api/admin/referrals');
    const json = await res.json();
    if (res.ok) setReferralConfig(json.config);
  };
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedReferralCustomer, setSelectedReferralCustomer] = useState<any>(null);
  const [addAmount, setAddAmount] = useState("");
  const [paymentReceivedAmount, setPaymentReceivedAmount] = useState("");
  const [reason, setReason] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingReferral, setIsSavingReferral] = useState(false);
  const [referralForm, setReferralForm] = useState({
    code: '',
    enabled: true,
    discountPercent: '3',
    buyerRewardPercent: '0',
    referrerRewardPercent: '3'
  });
  const [defaultReferralForm, setDefaultReferralForm] = useState({
    discountPercent: '3',
    buyerRewardPercent: '0',
    referrerRewardPercent: '3'
  });

  useEffect(() => {
    if (!referralConfig) return;
    setDefaultReferralForm({
      discountPercent: String(referralConfig.defaultDiscountPercent ?? 3),
      buyerRewardPercent: String(referralConfig.defaultBuyerRewardPercent ?? 0),
      referrerRewardPercent: String(referralConfig.defaultReferrerRewardPercent ?? 3)
    });
  }, [referralConfig]);

  const filteredCustomers = customers.filter(c => 
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2500);
  };

  const getReferralRule = (email: string) => referralConfig?.customers?.[email.toLowerCase()] || null;

  const openReferralModal = (customer: any) => {
    const rule = getReferralRule(customer.email);
    setSelectedReferralCustomer(customer);
    setReferralForm({
      code: rule?.code || '',
      enabled: rule?.enabled !== false,
      discountPercent: String(rule?.discountPercent ?? referralConfig?.defaultDiscountPercent ?? 3),
      buyerRewardPercent: String(rule?.buyerRewardPercent ?? referralConfig?.defaultBuyerRewardPercent ?? 0),
      referrerRewardPercent: String(rule?.referrerRewardPercent ?? referralConfig?.defaultReferrerRewardPercent ?? 3)
    });
  };

  const saveDefaultReferralRules = async () => {
    if (isSavingReferral) return;
    setIsSavingReferral(true);
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaults: defaultReferralForm })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '儲存失敗');
      setReferralConfig(json.config);
      showToast('✅ 預設推薦規則已更新');
    } catch (err: any) {
      showToast('❌ ' + err.message);
    } finally {
      setIsSavingReferral(false);
    }
  };

  const saveCustomerReferralRules = async () => {
    if (!selectedReferralCustomer || isSavingReferral) return;
    setIsSavingReferral(true);
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            email: selectedReferralCustomer.email,
            ...referralForm
          }
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '儲存失敗');
      setReferralConfig(json.config);
      setSelectedReferralCustomer(null);
      showToast('✅ 會員推薦碼規則已更新');
    } catch (err: any) {
      showToast('❌ ' + err.message);
    } finally {
      setIsSavingReferral(false);
    }
  };

  const handleAddTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // 防連點
    
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
    setIsSubmitting(true);

    try {
      const receivedAmount = paymentReceivedAmount === "" ? (amount > 0 ? amount : 0) : Number(paymentReceivedAmount);

      if (Number.isNaN(receivedAmount) || receivedAmount < 0) {
        showToast("⚠️ 請輸入有效的實際收款金額");
        setIsSubmitting(false);
        return;
      }

      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          amount: amount,
          paymentReceivedAmount: receivedAmount,
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
      setPaymentReceivedAmount("");
      setReason("");
      
      // 再抓取一次最新資料確保同步
      fetchCustomers();
    } catch (err: any) {
      showToast("❌ " + err.message);
    } finally {
      setIsSubmitting(false);
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
        <div className="mb-6 border border-cyan/20 bg-cyan/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <TicketPercent size={18} className="text-cyan" />
            <div>
              <h2 className="font-bold text-white">推薦碼預設規則</h2>
              <p className="text-xs text-white/45">會員自行設定推薦碼時會先套用這組比例，單一會員可再個別調整。</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3">
            <label className="text-xs text-white/55">
              結帳折扣 %
              <input type="number" min="0" max="100" value={defaultReferralForm.discountPercent} onChange={(e) => setDefaultReferralForm(prev => ({ ...prev, discountPercent: e.target.value }))} className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan" />
            </label>
            <label className="text-xs text-white/55">
              結帳者回饋 %
              <input type="number" min="0" max="100" value={defaultReferralForm.buyerRewardPercent} onChange={(e) => setDefaultReferralForm(prev => ({ ...prev, buyerRewardPercent: e.target.value }))} className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan" />
            </label>
            <label className="text-xs text-white/55">
              推薦人回饋 %
              <input type="number" min="0" max="100" value={defaultReferralForm.referrerRewardPercent} onChange={(e) => setDefaultReferralForm(prev => ({ ...prev, referrerRewardPercent: e.target.value }))} className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan" />
            </label>
            <button onClick={saveDefaultReferralRules} disabled={isSavingReferral} className="self-end bg-cyan/20 text-cyan hover:bg-cyan/30 disabled:bg-white/5 disabled:text-white/30 rounded-lg px-4 py-2 font-bold text-sm transition-colors">
              儲存
            </button>
          </div>
        </div>

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
                <th className="pb-3 px-4 font-medium">推薦碼</th>
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
                  <td className="py-4 px-4">
                    {getReferralRule(customer.email)?.code ? (
                      <span className="font-mono text-cyan bg-cyan/10 border border-cyan/20 rounded px-2 py-1 text-xs">{getReferralRule(customer.email).code}</span>
                    ) : (
                      <span className="text-white/25 text-sm">未設定</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-sm text-muted">
                    {customer.created_at}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => openReferralModal(customer)}
                        className="bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 px-4 py-2 rounded-lg text-sm font-bold transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        <TicketPercent size={16} />
                        推薦設定
                      </button>
                      <button 
                        onClick={() => setSelectedCustomer(customer)}
                        className="bg-cyan/20 text-cyan hover:bg-cyan/30 px-4 py-2 rounded-lg text-sm font-bold transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        <PlusCircle size={16} />
                        手動調整餘額
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
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

              <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg">
                <span className="text-sm text-muted">推薦碼</span>
                <span className="font-mono text-cyan text-sm">{getReferralRule(customer.email)?.code || '未設定'}</span>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted">註冊日: {customer.created_at}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => openReferralModal(customer)}
                    className="bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 px-3 py-2 rounded-lg text-sm font-bold transition-colors inline-flex items-center gap-2"
                  >
                    <TicketPercent size={15} />
                    推薦
                  </button>
                  <button 
                    onClick={() => setSelectedCustomer(customer)}
                    className="bg-cyan/20 text-cyan hover:bg-cyan/30 px-3 py-2 rounded-lg text-sm font-bold transition-colors inline-flex items-center gap-2"
                  >
                    <PlusCircle size={15} />
                    餘額
                  </button>
                </div>
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
              onClick={() => { setSelectedCustomer(null); setAddAmount(""); setPaymentReceivedAmount(""); setReason(""); }}
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
                    onChange={(e) => {
                      setAddAmount(e.target.value);
                      const nextAmount = Number(e.target.value);
                      if (paymentReceivedAmount === "" && Number.isFinite(nextAmount) && nextAmount > 0) {
                        setPaymentReceivedAmount(e.target.value);
                      }
                    }}
                    className="w-full bg-[#0B0B1A] md:bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow text-xl font-bold" 
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs md:text-sm text-muted pointer-events-none">
                    正數加值 / 負數扣款
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-muted mb-2">實際收款金額（列入營收）</label>
                <input
                  type="number"
                  min="0"
                  placeholder="例如 1000；活動贈送請填 0"
                  value={paymentReceivedAmount}
                  onChange={(e) => setPaymentReceivedAmount(e.target.value)}
                  className="w-full bg-[#0B0B1A] md:bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-400 text-xl font-bold"
                />
                <p className="text-xs text-white/40 mt-2">只有這個欄位會列入營收；客戶之後用儲值金結帳不會再重複列營收。</p>
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
                disabled={isSubmitting}
                className={`w-full font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all ${isSubmitting ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-yellow to-[#f5d061] text-dark hover:-translate-y-1'}`}
              >
                <Zap size={20} />
                {isSubmitting ? '處理中...' : '確認調整餘額'}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedReferralCustomer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-center items-center px-4">
          <div className="bg-[#1A1A2E] w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl relative border border-white/10 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedReferralCustomer(null)} className="absolute top-4 right-4 text-muted hover:text-white">✕</button>
            <h3 className="text-xl md:text-2xl font-black mb-6 pr-6">推薦碼與折扣設定</h3>
            <div className="bg-black/30 p-4 rounded-xl mb-6">
              <div className="text-sm text-muted mb-1">會員帳號</div>
              <div className="font-bold break-all">{selectedReferralCustomer.email}</div>
            </div>
            <div className="space-y-4">
              <label className="block text-sm text-muted">
                推薦碼
                <input
                  type="text"
                  value={referralForm.code}
                  onChange={(e) => setReferralForm(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))}
                  placeholder="例如 FIRST123；清空可移除"
                  className="mt-2 w-full bg-[#0B0B1A] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-300 font-mono"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={referralForm.enabled} onChange={(e) => setReferralForm(prev => ({ ...prev, enabled: e.target.checked }))} />
                啟用此推薦碼
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="text-xs text-white/55">
                  結帳折扣 %
                  <input type="number" min="0" max="100" value={referralForm.discountPercent} onChange={(e) => setReferralForm(prev => ({ ...prev, discountPercent: e.target.value }))} className="mt-1 w-full bg-[#0B0B1A] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-300" />
                </label>
                <label className="text-xs text-white/55">
                  結帳者回饋 %
                  <input type="number" min="0" max="100" value={referralForm.buyerRewardPercent} onChange={(e) => setReferralForm(prev => ({ ...prev, buyerRewardPercent: e.target.value }))} className="mt-1 w-full bg-[#0B0B1A] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-300" />
                </label>
                <label className="text-xs text-white/55">
                  推薦人回饋 %
                  <input type="number" min="0" max="100" value={referralForm.referrerRewardPercent} onChange={(e) => setReferralForm(prev => ({ ...prev, referrerRewardPercent: e.target.value }))} className="mt-1 w-full bg-[#0B0B1A] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-300" />
                </label>
              </div>
              <button
                type="button"
                onClick={saveCustomerReferralRules}
                disabled={isSavingReferral}
                className="w-full bg-gradient-to-r from-purple-300 to-cyan text-dark font-black py-4 rounded-xl hover:-translate-y-1 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-wait transition-all"
              >
                {isSavingReferral ? '儲存中...' : '儲存推薦設定'}
              </button>
            </div>
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
