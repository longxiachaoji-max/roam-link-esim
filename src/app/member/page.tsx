"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, MoreHorizontal, QrCode, Smartphone, CreditCard } from "lucide-react";
import Link from 'next/link';

export default function MemberCenter() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2500);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        // Fetch Profile
        const { data: customer } = await supabase
          .from('customers')
          .select('*')
          .eq('email', session.user.email)
          .single();
        
        if (customer) {
          setUser(customer);
        }

        // Fetch Orders via API
        const res = await fetch(`/api/member/orders?email=${session.user.email}`);
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        }
      } else {
        window.location.href = '/'; // Redirect home if not logged in
      }
      setIsLoading(false);
    };
    init();
  }, []);

  if (isLoading) {
    return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-white">載入中...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-sans pb-20 relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <button onClick={() => window.location.href = '/'} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
          <X size={20} className="text-white/70" />
        </button>
        <span className="font-bold tracking-wider">member-center-v2</span>
        <button className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
          <MoreHorizontal size={20} className="text-white/70" />
        </button>
      </div>
      
      <div className="p-4 md:max-w-md md:mx-auto">
        <h1 className="text-3xl font-black text-[#F05A28] mb-8 mt-2">Roam Link.</h1>
        
        {/* User Info */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#F05A28] rounded-full flex items-center justify-center text-2xl font-bold shadow-lg">
              {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div className="font-bold text-lg">{user?.name || '使用者'}</div>
              <div className="text-sm text-white/50">{user?.email}</div>
            </div>
          </div>
          <div className="bg-[#2a1a15] text-[#F05A28] px-3 py-1.5 rounded-full text-xs font-bold border border-[#F05A28]/30 flex items-center gap-1">
            ✦ 會員
          </div>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-[#222] to-[#111] rounded-3xl p-6 mb-10 border border-white/5 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#F05A28]/10 to-transparent pointer-events-none"></div>
          <div className="text-sm text-white/60 mb-2 relative z-10">儲值金餘額</div>
          <div className="flex items-baseline gap-1 mb-2 relative z-10">
            <span className="text-xl font-medium">NT$</span>
            <span className="text-5xl font-black text-[#f5bd61] tracking-tight">{user?.token_balance || 0}</span>
          </div>
          <div className="text-xs text-white/40 mb-8 relative z-10">上次儲值: {user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : '無紀錄'}</div>
          
          <div className="grid grid-cols-2 gap-4 relative z-10">
            <button 
              onClick={() => setIsTopUpOpen(true)} 
              className="bg-[#F05A28] hover:bg-[#d94f22] shadow-[0_0_15px_rgba(240,90,40,0.4)] text-white font-bold py-3.5 rounded-2xl transition-all"
            >
              + 儲值
            </button>
            <Link href="/member/history" className="bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-2xl transition-all text-center">
                消費紀錄
            </Link>
          </div>
        </div>

        {/* eSIM List */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">我的 eSIM</h2>
          <span className="text-sm text-white/50">共 {orders.length} 筆</span>
        </div>

        <div className="space-y-4">
          {orders.map(order => order.order_items.map((item: any) => (
            <div key={item.id} className="bg-[#1a1a24] rounded-3xl p-5 border border-white/5 shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl shadow-inner">
                     {item.products.country === '日本' ? '🇯🇵' : 
                      item.products.country === '韓國' ? '🇰🇷' : 
                      item.products.country === '泰國' ? '🇹🇭' : '🌍'}
                  </div>
                  <div>
                    <div className="font-bold text-lg">{item.products.name}</div>
                    <div className="text-xs text-white/40 mb-0.5">#{order.id.split('-')[0].toUpperCase()}</div>
                    <div className="text-xs text-white/40">訂購：{new Date(order.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-2.5 py-1 rounded-lg text-xs font-bold">
                  {item.e_sim_inventory ? '使用中' : '處理中'}
                </div>
              </div>

              {/* Data Usage Fake Bar */}
              <div className="mb-5 mt-6">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-white/50 font-medium">已使用流量</span>
                  <span className="text-white/70 font-medium">0GB / {item.products.data_amount || '無限'}</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-[#F05A28] to-[#f5bd61] h-1.5 rounded-full" style={{width: '5%'}}></div>
                </div>
              </div>

              {/* Plan Info */}
              <div className="flex justify-between border-t border-white/5 pt-4 mb-5 px-2">
                <div>
                  <div className="text-xs text-white/40 mb-1">方案</div>
                  <div className="font-bold text-sm text-white/90">{item.products.data_amount || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-white/40 mb-1">天數</div>
                  <div className="font-bold text-sm text-white/90">{item.products.validity_days} 天</div>
                </div>
                <div>
                  <div className="text-xs text-white/40 mb-1">金額</div>
                  <div className="font-bold text-sm text-white/90">NT${item.price}</div>
                </div>
              </div>

              {/* Action Buttons */}
              {item.e_sim_inventory && (
                <div className="flex gap-3">
                   <a 
                     href={`https://esimsetup.apple.com/esim_activate?smdp_address=${item.e_sim_inventory.smdp_address}&activation_code=${item.e_sim_inventory.activation_code}`}
                     className="flex-1 bg-[#1a2c3a] border border-cyan/20 hover:bg-cyan/20 text-cyan py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                   >
                     <Smartphone size={16} /> 一鍵安裝
                   </a>
                   <button 
                     className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                     onClick={() => setQrCodeData(`LPA:1$${item.e_sim_inventory.smdp_address}$${item.e_sim_inventory.activation_code}`)}
                   >
                     <QrCode size={16} /> 顯示 QRCODE
                   </button>
                </div>
              )}
            </div>
          )))}
          {orders.length === 0 && (
            <div className="text-center py-10 text-white/40">
              目前沒有 eSIM 訂單紀錄
            </div>
          )}
        </div>
      </div>

      {/* Top-up Modal */}
      {isTopUpOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-end md:items-center px-4 pb-4 md:pb-0 transition-opacity">
          <div className="bg-[#1A1A2E] w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative border border-white/10 animate-fade-in-up">
            <button onClick={() => setIsTopUpOpen(false)} className="absolute top-5 right-5 bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors">✕</button>
            
            <h3 className="text-2xl font-black mb-6 text-center mt-2">儲值金加值</h3>
            
            <div className="bg-black/30 rounded-2xl p-4 mb-6 text-center border border-white/5">
                <p className="text-white/50 text-sm mb-1">您目前的儲值金餘額</p>
                <p className="text-4xl font-black text-[#f5bd61]">NT$ {user?.token_balance}</p>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[200, 500, 1000].map((amount) => (
                <button 
                  key={amount} 
                  onClick={() => {
                    showToast(`⚠️ 正在導向 NT$ ${amount} 結帳 (等待綠界串接)`);
                  }}
                  className="bg-white/5 border border-white/10 hover:border-[#F05A28] hover:text-[#F05A28] rounded-2xl p-4 flex flex-col items-center gap-1 transition-all"
                >
                  <span className="font-bold text-lg">{amount}</span>
                </button>
              ))}
            </div>

            <button 
              className="w-full bg-white/5 text-white/30 font-black py-4 rounded-2xl flex justify-center items-center gap-2 cursor-not-allowed border border-white/5"
              disabled
            >
              <CreditCard size={20} />
              信用卡結帳 (等待串接)
            </button>
          </div>
        </div>
      )}

      {/* QR Code Modal (Placeholder) */}
      {qrCodeData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center px-4 transition-opacity">
          <div className="bg-[#1A1A2E] w-full max-w-xs rounded-[2rem] p-8 shadow-2xl relative border border-white/10 flex flex-col items-center">
            <button onClick={() => setQrCodeData(null)} className="absolute top-5 right-5 bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors">✕</button>
            <h3 className="text-xl font-bold mb-6">掃描加入 eSIM</h3>
            <div className="bg-white p-4 rounded-2xl mb-6">
               {/* 這裡先用 Icon 模擬 QR Code，之後可安裝 qrcode.react 套件替換 */}
               <QrCode size={200} className="text-black" />
            </div>
            <p className="text-xs text-white/50 text-center break-all w-full mb-2">LPA 碼: {qrCodeData}</p>
            <button onClick={() => {
                navigator.clipboard.writeText(qrCodeData);
                showToast('✅ 複製成功');
              }} 
              className="bg-white/10 hover:bg-white/20 text-white text-sm font-bold py-2 px-4 rounded-xl transition-colors">
              複製文字
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full font-bold shadow-2xl z-[100] animate-fade-in-up text-sm whitespace-nowrap">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
