"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, MoreHorizontal, QrCode, Smartphone, CreditCard, Trash2, Edit3, Check, Share2 } from "lucide-react";
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

export default function MemberCenter() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  
  // Note editing
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  // Name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameText, setNameText] = useState("");

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2500);
  };

  const fetchOrders = async (email: string) => {
    const res = await fetch(`/api/member/orders?email=${email}`);
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders || []);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const { data: customer } = await supabase
          .from('customers')
          .select('*')
          .eq('email', session.user.email)
          .single();
        
        if (customer) {
          setUser(customer);
        }
        await fetchOrders(session.user.email);
      } else {
        window.location.href = '/';
      }
      setIsLoading(false);
    };
    init();
  }, []);

  // Country flag mapping
  const getFlag = (country: string) => {
    const flags: Record<string, string> = {
      '日本': '🇯🇵', '韓國': '🇰🇷', '泰國': '🇹🇭', '越南': '🇻🇳',
      '新加坡': '🇸🇬', '馬來西亞': '🇲🇾', '中國': '🇨🇳', '香港': '🇭🇰',
      '台灣': '🇹🇼', '美國': '🇺🇸', '加拿大': '🇨🇦', '法國': '🇫🇷',
      '英國': '🇬🇧', '德國': '🇩🇪', '義大利': '🇮🇹', '澳洲': '🇦🇺',
    };
    return flags[country] || '🌍';
  };

  // Soft delete handler
  const handleSoftDelete = async (orderItemId: string) => {
    try {
      const res = await fetch('/api/member/esim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: orderItemId,
          email: user.email,
          action: 'soft_delete'
        })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '操作失敗');
      showToast('🗑️ 已標記刪除，將於 1 天後自動移除');
      setDeleteConfirmId(null);
      await fetchOrders(user.email);
    } catch (err: any) {
      showToast('❌ ' + err.message);
    }
  };

  // Note update handler
  const handleNoteUpdate = async (orderItemId: string, note: string) => {
    try {
      const res = await fetch('/api/member/esim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: orderItemId,
          email: user.email,
          action: 'update_note',
          note
        })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '操作失敗');
      showToast('✅ 備註已更新');
      setEditingNoteId(null);
      await fetchOrders(user.email);
    } catch (err: any) {
      showToast('❌ ' + err.message);
    }
  };

  // Check if item is soft-deleted
  const isSoftDeleted = (item: any) => !!item.user_deleted_at;

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
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameText}
                    onChange={(e) => setNameText(e.target.value)}
                    className="bg-white/5 border border-white/20 rounded-lg px-2 py-1 text-white text-base font-bold w-32 focus:outline-none focus:border-[#F05A28]/50"
                    autoFocus
                    placeholder="輸入名稱"
                  />
                  <button
                    onClick={async () => {
                      if (!nameText.trim()) return;
                      try {
                        const res = await fetch('/api/member/profile', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: user.email, name: nameText })
                        });
                        const json = await res.json();
                        if (!res.ok || json.error) throw new Error(json.error);
                        setUser({ ...user, name: nameText.trim() });
                        setIsEditingName(false);
                        showToast('✅ 名稱已更新');
                      } catch (err: any) {
                        showToast('❌ ' + err.message);
                      }
                    }}
                    className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="p-1.5 bg-white/5 hover:bg-white/10 text-white/50 rounded-lg transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="font-bold text-lg">{user?.name || '使用者'}</div>
                  <button
                    onClick={() => { setNameText(user?.name || ''); setIsEditingName(true); }}
                    className="p-1 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 rounded-lg transition-colors"
                    title="變更名稱"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              )}
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
          <span className="text-sm text-white/50">共 {orders.reduce((sum, o) => sum + o.order_items.filter((i: any) => !isSoftDeleted(i)).length, 0)} 筆</span>
        </div>

        <div className="space-y-4">
          {orders.map(order => order.order_items.map((item: any) => {
            const deleted = isSoftDeleted(item);
            
            return (
              <div key={item.id} className={`rounded-3xl p-5 border shadow-lg transition-all ${
                deleted 
                  ? 'bg-[#1a1a24]/50 border-white/5 opacity-50' 
                  : 'bg-[#1a1a24] border-white/5'
              }`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl shadow-inner">
                       {getFlag(item.products?.country || '')}
                    </div>
                    <div>
                      <div className="font-bold text-lg">{item.products?.name || '已下架商品'}</div>
                      <div className="text-xs text-white/40 mb-0.5">#{order.id.split('-')[0].toUpperCase()}</div>
                      <div className="text-xs text-white/40">訂購：{new Date(order.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {deleted ? (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-1 rounded-lg text-xs font-bold">
                        待移除
                      </div>
                    ) : (
                      <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-2.5 py-1 rounded-lg text-xs font-bold">
                        {item.e_sim_inventory ? '使用中' : '處理中'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Soft delete warning */}
                {deleted && (
                  <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 mb-4 text-center">
                    <p className="text-red-400 text-xs font-medium">⚠️ 此 eSIM 已標記刪除，將於 1 天後自動移除，此操作無法復原</p>
                    <p className="text-white/30 text-xs mt-1">刪除時間：{new Date(item.user_deleted_at).toLocaleString()}</p>
                  </div>
                )}

                {/* Note / Memo */}
                <div className="mb-4">
                  {editingNoteId === item.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="例如：老婆的日本旅行、2026東京出差"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#F05A28]/50"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        autoFocus
                      />
                      <button
                        onClick={() => handleNoteUpdate(item.id, noteText)}
                        className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl transition-colors"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="p-2 bg-white/5 hover:bg-white/10 text-white/50 rounded-xl transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (deleted) return;
                        setEditingNoteId(item.id);
                        setNoteText(item.note || '');
                      }}
                      className={`flex items-center gap-2 text-xs ${deleted ? 'text-white/20 cursor-not-allowed' : 'text-white/40 hover:text-white/60 cursor-pointer'} transition-colors`}
                    >
                      <Edit3 size={12} />
                      {item.note ? (
                        <span className="text-white/60">📝 {item.note}</span>
                      ) : (
                        <span>新增備註（旅行、使用者...）</span>
                      )}
                    </button>
                  )}
                </div>

                {/* Plan Info */}
                <div className="flex justify-between border-t border-white/5 pt-4 mb-5 px-2">
                  <div>
                    <div className="text-xs text-white/40 mb-1">方案</div>
                    <div className="font-bold text-sm text-white/90">{item.products?.data_amount || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/40 mb-1">天數</div>
                    <div className="font-bold text-sm text-white/90">{item.products?.validity_days || '-'} 天</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/40 mb-1">金額</div>
                    <div className="font-bold text-sm text-white/90">NT${item.price}</div>
                  </div>
                </div>

                {/* Action Buttons */}
                {item.e_sim_inventory && (
                  <div className="flex gap-3 mb-3">
                     <a 
                       href={`https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(`LPA:1$${item.e_sim_inventory.smdp_address}$${item.e_sim_inventory.activation_code}`)}`}
                       className={`flex-1 bg-[#1a2c3a] border border-cyan/20 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${deleted ? 'opacity-60' : 'hover:bg-cyan/20 text-cyan'}`}
                     >
                       <Smartphone size={16} /> iOS 17.4+ 一鍵安裝
                     </a>
                     <button 
                       className={`flex-1 bg-white/5 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${deleted ? 'opacity-60' : 'hover:bg-white/10'}`}
                       onClick={() => setQrCodeData(`LPA:1$${item.e_sim_inventory.smdp_address}$${item.e_sim_inventory.activation_code}`)}
                     >
                       <QrCode size={16} /> 顯示 QRCODE
                     </button>
                  </div>
                )}

                {/* Delete button */}
                {!deleted && (
                  <button
                    onClick={() => setDeleteConfirmId(item.id)}
                    className="w-full bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 text-white/40 hover:text-red-400 py-2.5 rounded-2xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Trash2 size={14} /> 刪除此 eSIM
                  </button>
                )}
              </div>
            );
          }))}
          {orders.length === 0 && (
            <div className="text-center py-10 text-white/40">
              目前沒有 eSIM 訂單紀錄
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center px-4">
          <div className="bg-[#1A1A2E] w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative border border-white/10">
            <h3 className="text-xl font-bold mb-3 text-center">確認刪除</h3>
            <p className="text-white/60 text-sm text-center mb-2">確定要刪除這個 eSIM 嗎？</p>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6">
              <p className="text-red-400 text-xs text-center font-medium">⚠️ 刪除後將反灰顯示，並於 1 天後自動移除，此操作無法復原。</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl transition-all"
              >
                取消
              </button>
              <button
                onClick={() => handleSoftDelete(deleteConfirmId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-2xl transition-all"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* QR Code Modal */}
      {qrCodeData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center px-4 transition-opacity">
          <div className="bg-[#1A1A2E] w-full max-w-xs rounded-[2rem] p-8 shadow-2xl relative border border-white/10 flex flex-col items-center">
            <button onClick={() => setQrCodeData(null)} className="absolute top-5 right-5 bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors">✕</button>
            <h3 className="text-xl font-bold mb-6">掃描加入 eSIM</h3>
            <div className="bg-white p-4 rounded-2xl mb-6 flex justify-center items-center w-[232px] h-[232px]">
               <QRCodeSVG value={qrCodeData} size={200} />
            </div>
            <p className="text-xs text-white/50 text-center break-all w-full mb-2">LPA 碼: {qrCodeData}</p>
            <div className="flex gap-3">
              <button onClick={() => {
                  navigator.clipboard.writeText(qrCodeData);
                  showToast('✅ 複製成功');
                }} 
                className="bg-white/10 hover:bg-white/20 text-white text-sm font-bold py-2 px-4 rounded-xl transition-colors flex items-center gap-1.5">
                📋 複製
              </button>
              <button onClick={async () => {
                  const installUrl = `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(qrCodeData!)}`;
                  const siteUrl = window.location.origin;
                  const shareText = [
                    '\ud83c\udf10 Roam Link eSIM \u5b89\u88dd\u8cc7\u8a0a',
                    '',
                    '\ud83d\udcf1 iOS 17.4+ \u4e00\u9375\u5b89\u88dd\uff1a',
                    installUrl,
                    '',
                    '\ud83d\udcdd LPA \u78bc (\u624b\u52d5\u8f38\u5165)\uff1a',
                    qrCodeData,
                    '',
                    '\ud83d\uded2 \u8cfc\u8ce3\u7db2\u7ad9\uff1a',
                    siteUrl
                  ].join('\n');
                  if (navigator.share) {
                    try {
                      await navigator.share({ title: 'Roam Link eSIM', text: shareText });
                    } catch(e) { /* cancelled */ }
                  } else {
                    navigator.clipboard.writeText(shareText);
                    showToast('\u2705 \u5df2\u8907\u88fd\u5b8c\u6574\u5b89\u88dd\u8cc7\u8a0a');
                  }
                }} 
                className="bg-[#F05A28]/20 hover:bg-[#F05A28]/30 text-[#F05A28] text-sm font-bold py-2 px-4 rounded-xl transition-colors flex items-center gap-1.5">
                <Share2 size={14} /> \u5206\u4eab\u7d66\u89aa\u53cb
              </button>
            </div>
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
