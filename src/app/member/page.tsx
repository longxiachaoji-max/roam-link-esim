"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, MoreHorizontal, QrCode, Smartphone, Trash2, Edit3, Check, Share2, CreditCard, Barcode, Activity, PackageSearch, Wifi, Clock3, MessageSquareText, Star } from "lucide-react";
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { sanitizeMicroesimUsageForDisplay } from '@/lib/microesim-usage-status';
import { MIN_REFERRAL_CODE_LENGTH, normalizeReferralCode, referralCodeLength } from '@/lib/referral-code';
import PhysicalOrdersPanel from './physical-orders-panel';
import BarcodeOrdersPanel from './barcode-orders-panel';

interface MemberReview {
  id: string;
  rating: number;
  smoothness_rating: number;
  comment: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

interface ReviewTarget {
  orderItemId: string;
  productName: string;
  country: string;
  review: MemberReview | null;
}

interface ReviewableOrderItem {
  id: string;
  products?: { name?: string; country?: string } | null;
  review?: MemberReview | null;
}

function ReviewStars({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return <div className="flex items-center gap-2" role="group" aria-label={label}>
    {[1, 2, 3, 4, 5].map(star => <button key={star} type="button" onClick={() => onChange(star)} aria-label={`${star} 星`} className="grid h-10 w-10 place-items-center rounded-md text-amber-300 hover:bg-amber-300/10 focus:outline-none focus:ring-2 focus:ring-amber-300/50"><Star size={26} fill={star <= value ? 'currentColor' : 'none'} className={star <= value ? '' : 'text-white/20'} /></button>)}
  </div>;
}

export default function MemberCenter() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals
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
  const [usageByItemId, setUsageByItemId] = useState<Record<string, any>>({});
  const [usageLoadingId, setUsageLoadingId] = useState<string | null>(null);
  const [purchaseReminderOpen, setPurchaseReminderOpen] = useState(false);
  const [installConfirmation, setInstallConfirmation] = useState<{ type: 'ios' | 'qr'; lpa: string } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [smoothnessRating, setSmoothnessRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  // Credit card topup
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('500');
  const [topupReferralCode, setTopupReferralCode] = useState('');
  const [topupPayingMethod, setTopupPayingMethod] = useState<'Credit' | 'BARCODE' | null>(null);

  // Promo code redeem
  const [promoCode, setPromoCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralRule, setReferralRule] = useState<any>(null);
  const [isSavingReferral, setIsSavingReferral] = useState(false);
  const [orderView, setOrderView] = useState<'esim' | 'physical' | 'barcode'>('esim');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2500);
  };

  const fetchOrders = async (_email: string) => {
    const res = await authenticatedFetch('/api/member/orders');
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders || []);
      const cachedUsage: Record<string, any> = {};
      for (const order of data.orders || []) {
        for (const item of order.order_items || []) {
          if (item.e_sim_inventory?.microesim_usage_cache) {
            cachedUsage[item.id] = {
              usage: item.e_sim_inventory.microesim_usage_cache,
              checkedAt: item.e_sim_inventory.microesim_usage_checked_at,
              stale: true
            };
          }
        }
      }
      setUsageByItemId(cachedUsage);
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
        const { data: { session: latestSession } } = await supabase.auth.getSession();
        if (latestSession?.access_token) {
          const referralRes = await fetch('/api/member/referral', {
            headers: { Authorization: `Bearer ${latestSession.access_token}` }
          });
          const referralJson = await referralRes.json();
          if (referralRes.ok) {
            setReferralRule(referralJson.referral);
            setReferralCode(referralJson.referral?.code || '');
          }
        }
        await fetchOrders(session.user.email);
      } else {
        window.location.href = '/';
      }
      setIsLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (params.get('view') === 'barcode') {
      window.setTimeout(() => setOrderView('barcode'), 0);
      window.history.replaceState({}, '', '/member');
    }
    if (params.get('topup') === '1') {
      window.setTimeout(() => setIsTopupOpen(true), 0);
      window.history.replaceState({}, '', '/member');
    }
    if (payment === 'success') {
      window.localStorage.removeItem('roam-link-cart-v1');
      window.history.replaceState({}, '', '/member');
      window.setTimeout(() => showToast('付款成功，訂單已更新'), 0);
      window.setTimeout(() => setPurchaseReminderOpen(true), 0);
    } else if (payment === 'barcode') {
      window.localStorage.removeItem('roam-link-cart-v1');
      window.history.replaceState({}, '', '/member');
      window.setTimeout(() => setOrderView('barcode'), 0);
      window.setTimeout(() => showToast('超商條碼已建立，繳費完成後訂單會自動更新'), 0);
    } else if (payment === 'pending') {
      window.history.replaceState({}, '', '/member');
      window.setTimeout(() => showToast('付款結果確認中，請稍後重新整理'), 0);
    }
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
      const res = await authenticatedFetch('/api/member/esim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: orderItemId,
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

  const startTopupCheckout = async (paymentMethod: 'Credit' | 'BARCODE') => {
    const numericAmount = Number(topupAmount);
    if (!Number.isInteger(numericAmount) || numericAmount < 200) {
      showToast('❌ 儲值金額最低 NT$200');
      return;
    }
    if (numericAmount > 100000) {
      showToast('❌ 單筆儲值不得超過 NT$100,000');
      return;
    }
    if (topupPayingMethod) return;
    setTopupPayingMethod(paymentMethod);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('登入狀態已過期，請重新登入');

      const res = await fetch('/api/ecpay/topup/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          amount: numericAmount,
          paymentMethod,
          referralCode: topupReferralCode.trim() || undefined,
          returnOrigin: window.location.origin,
          returnPath: '/member'
        })
      });
      const result = await res.json();
      if (!res.ok || !result.action || !result.fields) {
        throw new Error(result.error || '無法建立儲值付款');
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = result.action;
      form.style.display = 'none';
      Object.entries(result.fields as Record<string, string>).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err: any) {
      showToast('❌ ' + err.message);
      setTopupPayingMethod(null);
    }
  };

  // Note update handler
  const handleNoteUpdate = async (orderItemId: string, note: string) => {
    try {
      const res = await authenticatedFetch('/api/member/esim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: orderItemId,
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
  const isDeleteWindowExpired = (item: any) => {
    if (!item.user_deleted_at) return false;
    const deletedAt = new Date(item.user_deleted_at).getTime();
    if (!Number.isFinite(deletedAt)) return false;
    return Date.now() - deletedAt >= 24 * 60 * 60 * 1000;
  };
  const getDeleteUntilText = (item: any) => {
    if (!item.user_deleted_at) return '';
    const deletedAt = new Date(item.user_deleted_at).getTime();
    if (!Number.isFinite(deletedAt)) return '';
    const deleteAt = new Date(deletedAt + 24 * 60 * 60 * 1000);
    return deleteAt.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatUsageDate = (value: string | null | undefined) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUsageValue = (value: any) => {
    if (value === null || value === undefined || value === '') return '尚未回傳';
    return String(value);
  };

  const continueInstallation = () => {
    if (!installConfirmation) return;
    if (installConfirmation.type === 'ios') {
      window.location.href = `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(installConfirmation.lpa)}`;
    } else {
      setQrCodeData(installConfirmation.lpa);
    }
    setInstallConfirmation(null);
  };

  const handleUsageQuery = async (item: any) => {
    if (!user?.email) return;
    setUsageLoadingId(item.id);
    try {
      const res = await authenticatedFetch('/api/member/esim-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: item.id
        })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '查詢用量失敗');
      setUsageByItemId(prev => ({
        ...prev,
        [item.id]: {
          usage: json.usage,
          checkedAt: json.checkedAt,
          stale: Boolean(json.stale),
          warning: json.warning
        }
      }));
    } catch (err: any) {
      showToast('❌ ' + (err?.message || '查詢用量失敗'));
    } finally {
      setUsageLoadingId(null);
    }
  };

  const openReview = (item: ReviewableOrderItem) => {
    const review = item.review || null;
    setReviewTarget({
      orderItemId: item.id,
      productName: item.products?.name || 'eSIM 方案',
      country: item.products?.country || '旅遊地區',
      review
    });
    setReviewRating(review?.rating || 0);
    setSmoothnessRating(review?.smoothness_rating || 0);
    setReviewComment(review?.comment || '');
  };

  const submitReview = async () => {
    if (!reviewTarget || reviewSaving) return;
    if (!reviewRating || !smoothnessRating) {
      showToast('請完成星級與使用順暢度評分');
      return;
    }
    if (reviewComment.trim().length < 2) {
      showToast('請留下至少 2 個字的使用心得');
      return;
    }

    setReviewSaving(true);
    try {
      const response = await authenticatedFetch('/api/member/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderItemId: reviewTarget.orderItemId,
          rating: reviewRating,
          smoothnessRating,
          comment: reviewComment.trim()
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '評價送出失敗');
      setReviewTarget(null);
      showToast(reviewTarget.review ? '評價已更新，謝謝您的回饋' : '謝謝您留下真實使用體驗');
      if (user?.email) await fetchOrders(user.email);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '評價送出失敗');
    } finally {
      setReviewSaving(false);
    }
  };

  const visibleEsimCount = orders.reduce((sum, order) => (
    sum + order.order_items.filter((item: any) => !isDeleteWindowExpired(item)).length
  ), 0);

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
                        const res = await authenticatedFetch('/api/member/profile', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: nameText })
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
              type="button"
              onClick={() => setIsTopupOpen(true)}
              className="bg-[#F05A28] hover:bg-[#d94f22] shadow-[0_0_15px_rgba(240,90,40,0.4)] text-white text-center font-bold py-3.5 rounded-2xl transition-all"
            >
              + 儲值
            </button>
            <Link href="/member/history" className="bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-2xl transition-all text-center">
                消費紀錄
            </Link>
          </div>
        </div>

        {isTopupOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center px-4">
            <div className="bg-[#1A1A2E] w-full max-w-md rounded-[2rem] p-6 shadow-2xl relative border border-white/10">
              <button
                onClick={() => { if (!topupPayingMethod) setIsTopupOpen(false); }}
                className="absolute top-4 right-4 bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white"
              >
                ✕
              </button>
              <h3 className="text-2xl font-black mb-2">會員儲值</h3>
              <p className="text-sm text-white/45 mb-6">付款完成後會自動加入會員儲值金，最低 NT$200。</p>

              <label className="block mb-4">
                <span className="block text-sm text-white/60 mb-2">儲值金額</span>
                <div className="flex items-center bg-black/30 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-[#F05A28]/60">
                  <span className="text-white/40 font-bold mr-2">NT$</span>
                  <input
                    type="number"
                    min="200"
                    max="100000"
                    step="1"
                    inputMode="numeric"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-3xl font-black text-white outline-none"
                    autoFocus
                  />
                </div>
              </label>

              <div className="grid grid-cols-4 gap-2 mb-5">
                {[200, 500, 1000, 2000].map(amount => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setTopupAmount(String(amount))}
                    className={`rounded-xl py-2 text-sm font-bold border transition-colors ${Number(topupAmount) === amount ? 'bg-[#F05A28] border-[#F05A28] text-white' : 'bg-white/5 border-white/10 text-white/65 hover:bg-white/10'}`}
                  >
                    {amount}
                  </button>
                ))}
              </div>

              <label className="block mb-5">
                <span className="block text-sm text-white/60 mb-2">推薦碼（選填）</span>
                <input
                  type="text"
                  value={topupReferralCode}
                  onChange={(e) => setTopupReferralCode(normalizeReferralCode(e.target.value))}
                  placeholder="儲值不折扣，只依設定回饋"
                  className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-[#F05A28]/60 font-mono placeholder:font-sans placeholder:text-white/25"
                />
              </label>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-5">
                <div className="flex justify-between text-sm text-white/55 mb-2">
                  <span>儲值金</span>
                  <span>NT${(Number(topupAmount) || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="font-bold">應付金額</span>
                  <span className="text-2xl font-black text-[#f5bd61]">NT${(Number(topupAmount) || 0).toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => startTopupCheckout('Credit')}
                disabled={topupPayingMethod !== null || Number(topupAmount) < 200}
                className="w-full bg-[#168b55] hover:bg-[#1a9d62] disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors mb-3"
              >
                <CreditCard size={20} />
                {topupPayingMethod === 'Credit' ? '正在前往綠界...' : '信用卡付款'}
              </button>
              <button
                onClick={() => startTopupCheckout('BARCODE')}
                disabled={topupPayingMethod !== null || Number(topupAmount) < 200}
                className="w-full bg-white/10 hover:bg-white/15 border border-white/10 disabled:bg-white/5 disabled:text-white/30 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
              >
                <Barcode size={20} />
                {topupPayingMethod === 'BARCODE' ? '正在產生條碼...' : '超商條碼付款'}
              </button>
              <div className="mt-3 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-medium leading-5 text-amber-200">
                超商付款約 3 天入帳，入帳後將自動加入儲值金。
              </div>
            </div>
          </div>
        )}

        {/* Referral Code */}
        <div className="bg-[#1a1a24] rounded-2xl p-5 border border-white/5 mb-10">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white/70">我的推薦碼</h3>
              <p className="text-xs text-white/40 mt-1">朋友結帳輸入後可折扣，系統會依後台設定回饋儲值金。</p>
            </div>
            {referralRule?.enabled && (
              <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-400/20 px-2 py-1 rounded-full text-xs font-bold">啟用中</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="例如 一飛通或 FIRST123"
              value={referralCode}
              onChange={(e) => setReferralCode(normalizeReferralCode(e.target.value))}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#F05A28]/50 uppercase font-mono"
            />
            <button
              disabled={isSavingReferral || referralCodeLength(referralCode) < MIN_REFERRAL_CODE_LENGTH}
              onClick={async () => {
                if (isSavingReferral || referralCodeLength(referralCode) < MIN_REFERRAL_CODE_LENGTH) return;
                setIsSavingReferral(true);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session?.access_token) throw new Error('登入狀態已過期，請重新登入');
                  const res = await fetch('/api/member/referral', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ code: referralCode })
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error || '儲存失敗');
                  setReferralRule(json.referral);
                  setReferralCode(json.referral.code);
                  showToast('✅ 推薦碼已更新');
                } catch (err: any) {
                  showToast('❌ ' + err.message);
                } finally {
                  setIsSavingReferral(false);
                }
              }}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#F05A28] hover:bg-[#d94f22] disabled:bg-white/5 disabled:text-white/30 disabled:cursor-not-allowed transition-all"
            >
              {isSavingReferral ? '儲存中' : '儲存'}
            </button>
          </div>
        </div>

        {/* Promo Code Redeem */}
        <div className="bg-[#1a1a24] rounded-2xl p-5 border border-white/5 mb-10">
          <h3 className="text-sm font-bold text-white/70 mb-3">🎁 兌換代碼</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="輸入兌換碼"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#F05A28]/50 uppercase"
            />
            <button
              disabled={isRedeeming || !promoCode.trim()}
              onClick={async () => {
                if (isRedeeming || !promoCode.trim()) return;
                setIsRedeeming(true);
                try {
                  const res = await authenticatedFetch('/api/promo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: promoCode })
                  });
                  const json = await res.json();
                  if (!res.ok || json.error) throw new Error(json.error);
                  showToast(`\ud83c\udf89 ${json.message}`);
                  setUser({ ...user, token_balance: json.newBalance });
                  setPromoCode('');
                } catch (err: any) {
                  showToast('\u274c ' + err.message);
                } finally {
                  setIsRedeeming(false);
                }
              }}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${isRedeeming || !promoCode.trim() ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-[#F05A28] hover:bg-[#d94f22] text-white'}`}
            >
              {isRedeeming ? '...' : '兌換'}
            </button>
          </div>
        </div>

        {/* Playground / Mini Games */}
        <div className="bg-gradient-to-r from-purple-900/40 to-[#F05A28]/20 rounded-2xl p-5 border border-white/5 mb-10 relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white mb-1">🎮 旅行遊樂場</h3>
              <p className="text-xs text-white/60">玩小遊戲過關，賺取免費儲值金！</p>
            </div>
            <Link href="/games" className="bg-white/10 hover:bg-white/20 text-white text-sm font-bold px-4 py-2 rounded-full border border-white/10 transition-all flex items-center gap-1">
              開始遊戲 <span className="text-xs">▶</span>
            </Link>
          </div>
          <div className="absolute right-0 bottom-0 text-7xl opacity-10 translate-x-4 translate-y-4">
            🕹️
          </div>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-1 rounded-md border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setOrderView('esim')}
            className={`flex min-h-11 items-center justify-center gap-2 rounded px-3 text-sm font-bold transition-colors ${orderView === 'esim' ? 'bg-[#F05A28] text-white shadow' : 'text-white/50 hover:bg-white/5 hover:text-white/80'}`}
          >
            <Smartphone size={17} />
            我的 eSIM
          </button>
          <button
            type="button"
            onClick={() => setOrderView('physical')}
            className={`flex min-h-11 items-center justify-center gap-2 rounded px-3 text-sm font-bold transition-colors ${orderView === 'physical' ? 'bg-[#F05A28] text-white shadow' : 'text-white/50 hover:bg-white/5 hover:text-white/80'}`}
          >
            <PackageSearch size={17} />
            實體訂單
          </button>
          <button
            type="button"
            onClick={() => setOrderView('barcode')}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded px-2 text-sm font-bold transition-colors ${orderView === 'barcode' ? 'bg-[#F05A28] text-white shadow' : 'text-white/50 hover:bg-white/5 hover:text-white/80'}`}
          >
            <Barcode size={17} />
            超商付款
          </button>
        </div>

        {orderView === 'esim' ? <>
          {/* eSIM List */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">我的 eSIM</h2>
            <span className="text-sm text-white/50">共 {visibleEsimCount} 筆</span>
          </div>

          <div className="space-y-4">
          {orders.map(order => order.order_items.filter((item: any) => !isDeleteWindowExpired(item)).map((item: any) => {
            const deleted = isSoftDeleted(item);
            const usageResult = usageByItemId[item.id];
            const usage = usageResult?.usage
              ? sanitizeMicroesimUsageForDisplay(usageResult.usage)
              : null;
            
            return (
              <div key={item.id} className={`rounded-3xl p-5 border shadow-lg transition-all bg-[#1a1a24] border-white/5 ${deleted ? 'opacity-45 grayscale' : ''}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl shadow-inner">
                       {getFlag(item.products?.country || '')}
                    </div>
                    <div>
                      <div className="font-bold text-lg">{item.products?.name || '已下架商品'}</div>
                      <div className="text-xs text-white/40 mb-0.5">#{order.order_number || order.id.split('-')[0].toUpperCase()}</div>
                      <div className="text-xs text-white/40">訂購：{new Date(order.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`${deleted ? 'bg-red-500/10 border-red-500/20 text-red-300' : item.e_sim_inventory ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'} border px-2.5 py-1 rounded-lg text-xs font-bold`}>
                      {deleted ? '刪除倒數中' : item.e_sim_inventory ? '已配發' : '處理中'}
                    </div>
                  </div>
                </div>

                {deleted && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-100/80 rounded-2xl px-4 py-3 text-sm mb-4">
                    此 eSIM 已標記刪除，預計 {getDeleteUntilText(item)} 後從會員中心隱藏。如需恢復請聯絡客服。
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
                        setEditingNoteId(item.id);
                        setNoteText(item.note || '');
                      }}
                      className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 cursor-pointer transition-colors"
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
                {item.e_sim_inventory && !deleted && (
                  <>
                    <div className="mb-3 border-l-2 border-yellow-300/70 bg-yellow-300/5 px-3 py-3 text-sm">
                      <div className="flex items-center gap-2 font-bold text-yellow-100">
                        <Clock3 size={16} /> 請於啟用日前或旅程出發前完成安裝
                      </div>
                      <p className="mt-1 text-xs leading-5 text-white/60">
                        最晚安裝日：{formatUsageDate(item.e_sim_inventory.installation_deadline || item.e_sim_inventory.expiry_date)}
                      </p>
                      <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-white/60">
                        <Wifi className="mt-0.5 shrink-0" size={14} /> 安裝前請確認手機已連接穩定的 Wi-Fi 或行動網路，安裝過程請勿中斷連線。
                      </p>
                    </div>
                    <div className="flex gap-3 mb-3">
                       <button
                         type="button"
                         onClick={() => setInstallConfirmation({ type: 'ios', lpa: `LPA:1$${item.e_sim_inventory.smdp_address}$${item.e_sim_inventory.activation_code}` })}
                         className="flex-1 bg-[#1a2c3a] border border-cyan/20 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:bg-cyan/20 text-cyan"
                       >
                         <Smartphone size={16} /> iOS 17.4+ 一鍵安裝
                       </button>
                       <button 
                         className="flex-1 bg-white/5 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:bg-white/10"
                         onClick={() => setInstallConfirmation({ type: 'qr', lpa: `LPA:1$${item.e_sim_inventory.smdp_address}$${item.e_sim_inventory.activation_code}` })}
                       >
                         <QrCode size={16} /> 顯示 QRCODE
                       </button>
                    </div>

                    <div className="mb-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white/90">用量與到期日</p>
                          <p className="text-xs text-white/40 mt-0.5">
                            {item.e_sim_inventory.microesim_topup_id ? '由電信系統即時查詢' : '此 eSIM 不支援即時用量查詢'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUsageQuery(item)}
                          disabled={!item.e_sim_inventory.microesim_topup_id || usageLoadingId === item.id}
                          className="shrink-0 rounded-xl border border-cyan/20 bg-cyan/10 px-3 py-2 text-xs font-bold text-cyan hover:bg-cyan/20 disabled:border-white/5 disabled:bg-white/5 disabled:text-white/30 flex items-center gap-1.5"
                        >
                          <Activity size={14} />
                          {usageLoadingId === item.id ? '查詢中...' : '查詢用量'}
                        </button>
                      </div>

                      {usageResult && usage && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl bg-black/20 p-2">
                            <div className="text-white/35 mb-1">剩餘流量</div>
                            <div className="font-bold text-white/90">{getUsageValue(usage.remainingData)}</div>
                          </div>
                          <div className="rounded-xl bg-black/20 p-2">
                            <div className="text-white/35 mb-1">已用流量</div>
                            <div className="font-bold text-white/90">{getUsageValue(usage.usedData)}</div>
                          </div>
                          <div className="rounded-xl bg-black/20 p-2">
                            <div className="text-white/35 mb-1">安裝狀態</div>
                            <div className="font-bold text-white/90">{getUsageValue(usage.status)}</div>
                          </div>
                          <div className="rounded-xl bg-black/20 p-2">
                            <div className="text-white/35 mb-1">{usage.expiresAt ? '方案到期日' : '最晚安裝期限'}</div>
                            <div className="font-bold text-white/90">
                              {formatUsageDate(usage.expiresAt || usage.installationDeadline)}
                            </div>
                          </div>
                          <div className="col-span-2 text-white/35 px-1">
                            最後查詢：{formatUsageDate(usageResult.checkedAt)}
                            {usageResult.stale && <span className="ml-2 text-yellow-300/80">快取資料</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {!item.e_sim_inventory && !deleted && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-100/80 rounded-2xl px-4 py-3 text-sm mb-3">
                    eSIM 正在處理中，配發完成後這裡會自動出現安裝按鈕與 QR Code。
                  </div>
                )}

                {!deleted && order.order_status === 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={() => openReview(item)}
                    className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/8 py-2.5 text-xs font-bold text-amber-100 transition-colors hover:bg-amber-300/15"
                  >
                    {item.review ? <Star size={15} fill="currentColor" /> : <MessageSquareText size={15} />}
                    {item.review ? `已評價 ${item.review.rating} 星 · 查看或修改` : '留下使用評價'}
                  </button>
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
          {visibleEsimCount === 0 && (
            <div className="text-center py-10 text-white/40">
              目前沒有 eSIM 訂單紀錄
            </div>
          )}
          </div>
        </> : orderView === 'physical' ? <PhysicalOrdersPanel /> : <BarcodeOrdersPanel />}
      </div>

      {purchaseReminderOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-md border border-white/10 bg-[#1A1A2E] p-6 shadow-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-yellow-300/10 text-yellow-200">
              <Wifi size={22} />
            </div>
            <h3 className="text-xl font-bold">付款成功，安裝前請留意</h3>
            <p className="mt-3 text-sm leading-6 text-white/65">請於啟用日前或旅程出發前完成安裝 eSIM。安裝時請連接穩定的 Wi-Fi 或行動網路，過程中不要切換網路或關閉手機。</p>
            <p className="mt-3 text-sm leading-6 text-white/65">每張 eSIM 的最晚安裝日會顯示在會員中心卡片上；方案效期則依商品規則從安裝或連上當地網路後開始計算。</p>
            <button type="button" onClick={() => setPurchaseReminderOpen(false)} className="mt-6 h-12 w-full rounded-md bg-[#F05A28] font-bold text-white hover:bg-[#d94f22]">查看我的 eSIM</button>
          </div>
        </div>
      )}

      {installConfirmation && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-md border border-white/10 bg-[#1A1A2E] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-cyan/10 text-cyan"><Wifi size={21} /></div>
              <div><h3 className="text-xl font-bold">安裝前確認</h3><p className="mt-0.5 text-xs text-white/45">確認完成後再開啟安裝</p></div>
            </div>
            <div className="space-y-3 border-y border-white/10 py-4 text-sm leading-6 text-white/70">
              <p>請於啟用日前或旅程出發前完成安裝。</p>
              <p>請先連接穩定的 Wi-Fi 或行動網路，安裝期間不要中斷連線。</p>
              <p>安裝完成後請勿刪除 eSIM，部分方案刪除後無法再次安裝。</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setInstallConfirmation(null)} className="h-12 rounded-md border border-white/15 text-sm font-bold text-white/65 hover:bg-white/5">稍後安裝</button>
              <button type="button" onClick={continueInstallation} className="h-12 rounded-md bg-cyan text-sm font-bold text-[#071317] hover:bg-cyan/90">已確認，繼續</button>
            </div>
          </div>
        </div>
      )}

      {reviewTarget && (
        <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-md border border-white/10 bg-[#1A1A2E] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold text-amber-200/70">{reviewTarget.country}使用體驗</p><h3 className="mt-1 text-xl font-bold">{reviewTarget.review ? '查看或修改評價' : '感謝您的使用'}</h3></div>
              <button type="button" onClick={() => setReviewTarget(null)} title="關閉" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-white/45 hover:bg-white/5 hover:text-white"><X size={19} /></button>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/60">為持續提升產品品質，邀請您留下真實的使用體驗。您的回饋會幫助我們持續進步，也能協助其他旅客選擇合適的方案。</p>
            <p className="mt-3 truncate rounded-md bg-white/5 px-3 py-2 text-xs text-white/45">{reviewTarget.productName}</p>

            <div className="mt-6">
              <div className="flex items-center justify-between"><label className="text-sm font-bold">整體星級</label><span className="text-xs text-white/40">{reviewRating ? `${reviewRating} / 5` : '請評分'}</span></div>
              <ReviewStars value={reviewRating} onChange={setReviewRating} label="整體星級" />
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between"><label className="text-sm font-bold">{reviewTarget.country}使用順暢度</label><span className="text-xs text-cyan-200/70">{['', '不順暢', '偶有中斷', '普通', '順暢', '非常順暢'][smoothnessRating] || '請評分'}</span></div>
              <ReviewStars value={smoothnessRating} onChange={setSmoothnessRating} label={`${reviewTarget.country}使用順暢度`} />
            </div>
            <label className="mt-5 block text-sm font-bold">使用心得<textarea value={reviewComment} onChange={event => setReviewComment(event.target.value.slice(0, 1000))} rows={5} placeholder="例如：在東京與大阪使用都很順暢，地圖和影片載入速度穩定。" className="mt-2 w-full resize-none rounded-md border border-white/10 bg-[#0d0d1a] p-3 text-sm font-normal leading-6 text-white outline-none placeholder:text-white/25 focus:border-cyan/40" /></label>
            <div className="mt-1 text-right text-xs text-white/30">{reviewComment.length} / 1000</div>
            <p className="mt-3 text-xs leading-5 text-white/35">送出後，星級與留言可能以「已購買會員」名義顯示於商品頁；不會公開您的 Email。</p>
            <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => setReviewTarget(null)} className="h-11 rounded-md border border-white/15 text-sm font-bold text-white/60 hover:bg-white/5">取消</button><button type="button" onClick={() => void submitReview()} disabled={reviewSaving} className="h-11 rounded-md bg-[#F05A28] text-sm font-bold text-white hover:bg-[#d94f22] disabled:opacity-45">{reviewSaving ? '送出中...' : reviewTarget.review ? '儲存修改' : '送出評價'}</button></div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center px-4">
          <div className="bg-[#1A1A2E] w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative border border-white/10">
            <h3 className="text-xl font-bold mb-3 text-center">確認刪除</h3>
            <p className="text-white/60 text-sm text-center mb-2">確定要刪除這個 eSIM 嗎？</p>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6">
              <p className="text-red-400 text-xs text-center font-medium">刪除後會先反灰保留 24 小時，之後才會從會員中心隱藏。如誤刪可請客服從後台恢復。</p>
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

      {/* QR Code Modal */}
      {qrCodeData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center px-4 transition-opacity">
          <div className="bg-[#1A1A2E] w-full max-w-xs rounded-[2rem] p-8 shadow-2xl relative border border-white/10 flex flex-col items-center">
            <button onClick={() => setQrCodeData(null)} className="absolute top-5 right-5 bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors">✕</button>
            <h3 className="text-xl font-bold mb-6">掃描加入 eSIM</h3>
            <div className="qr-share-area bg-white p-4 rounded-2xl mb-6 flex justify-center items-center w-[232px] h-[232px]">
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
                  const shareText = `Roam Link eSIM 安裝資訊\n\niOS 17.4+ 一鍵安裝:\n${installUrl}\n\nLPA 碼:\n${qrCodeData}\n\n購買網站: ${siteUrl}`;
                  // 嘗試生成 QR Code 圖片並分享
                  const svgEl = document.querySelector('.qr-share-area svg') as SVGElement | null;
                  let shareFile: File | null = null;
                  if (svgEl) {
                    try {
                      const canvas = document.createElement('canvas');
                      canvas.width = 400; canvas.height = 400;
                      const ctx = canvas.getContext('2d')!;
                      ctx.fillStyle = 'white';
                      ctx.fillRect(0, 0, 400, 400);
                      const svgData = new XMLSerializer().serializeToString(svgEl);
                      const img = new Image();
                      await new Promise<void>((resolve, reject) => {
                        img.onload = () => resolve();
                        img.onerror = reject;
                        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                      });
                      ctx.drawImage(img, 20, 20, 360, 360);
                      const blob = await new Promise<Blob>((r) => canvas.toBlob(b => r(b!), 'image/png'));
                      shareFile = new File([blob], 'esim-qrcode.png', { type: 'image/png' });
                    } catch(e) { /* fallback to text only */ }
                  }
                  if (navigator.share) {
                    try {
                      const shareData: ShareData = { title: 'Roam Link eSIM', text: shareText };
                      if (shareFile && navigator.canShare?.({ files: [shareFile] })) {
                        shareData.files = [shareFile];
                      }
                      await navigator.share(shareData);
                    } catch(e) { /* cancelled */ }
                  } else {
                    navigator.clipboard.writeText(shareText);
                    showToast('✅ 已複製安裝資訊');
                  }
                }} 
                className="bg-[#F05A28]/20 hover:bg-[#F05A28]/30 text-[#F05A28] text-sm font-bold py-2 px-4 rounded-xl transition-colors flex items-center gap-1.5">
                <Share2 size={14} /> 分享給親友
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
