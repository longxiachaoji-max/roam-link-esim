"use client";

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, MessageSquareText, PackageCheck, RefreshCw, Star, Store, Trash2, Truck, X } from 'lucide-react';
import Link from 'next/link';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { canMemberDeletePhysicalOrder, getPhysicalOrderDeleteHidesAt } from '@/lib/physical-order-visibility';

interface PhysicalOrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  rental_start_date: string | null;
  rental_end_date: string | null;
  rental_days: number | null;
  rental_daily_rate: number | null;
  review: { id: string; rating: number; comment: string; is_visible: boolean; created_at: string; updated_at: string } | null;
}

interface PhysicalReviewTarget {
  item: PhysicalOrderItem;
}

function RatingStars({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="flex items-center gap-2" role="group" aria-label="商品整體星級">{[1, 2, 3, 4, 5].map(star => <button key={star} type="button" onClick={() => onChange(star)} aria-label={`${star} 星`} className="grid h-10 w-10 place-items-center rounded-md text-amber-300 hover:bg-amber-300/10 focus:outline-none focus:ring-2 focus:ring-amber-300/50"><Star size={26} fill={star <= value ? 'currentColor' : 'none'} className={star <= value ? '' : 'text-white/20'} /></button>)}</div>;
}

interface PhysicalOrder {
  id: string;
  created_at: string;
  updated_at: string;
  user_deleted_at: string | null;
  recipient_name: string;
  recipient_phone: string;
  postal_code: string | null;
  shipping_address: string;
  shipping_note: string | null;
  delivery_method: 'shipping' | 'pickup';
  subtotal: number;
  shipping_fee: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  physical_order_items: PhysicalOrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: '等待付款',
  PROCESSING: '備貨中',
  STOCK_ISSUE: '需要人工確認',
  SHIPPED: '已出貨',
  COMPLETED: '已完成',
  CANCELLED: '已取消'
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
  PENDING_PAYMENT: '尚未收到付款，付款完成後才會開始處理。',
  PROCESSING: '訂單已成立，工作人員正在備貨或安排租借。',
  STOCK_ISSUE: '商品狀態需要人工確認，客服會協助處理。',
  SHIPPED: '商品已寄出或租借交付已安排。',
  COMPLETED: '這筆訂單已完成。',
  CANCELLED: '這筆訂單已取消，租借日期已釋放。'
};

const PROGRESS_STEPS = [
  { label: '成立', icon: Store },
  { label: '備貨', icon: PackageCheck },
  { label: '出貨', icon: Truck },
  { label: '完成', icon: PackageCheck }
];

function progressIndex(status: string) {
  if (status === 'COMPLETED') return 3;
  if (status === 'SHIPPED') return 2;
  if (status === 'PROCESSING' || status === 'STOCK_ISSUE') return 1;
  return 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })
    .format(new Date(`${value}T00:00:00`));
}

function paymentLabel(method: string) {
  if (method === 'TOKENS') return '儲值金';
  if (method === 'ECPAY_BARCODE') return '超商條碼';
  if (method === 'ECPAY_CREDIT') return '信用卡';
  return method;
}

function formatDeleteHideAt(value: string) {
  const hidesAt = getPhysicalOrderDeleteHidesAt(value);
  if (hidesAt === null) return '';
  return new Date(hidesAt).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function PhysicalOrdersPanel() {
  const [orders, setOrders] = useState<PhysicalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<PhysicalOrder | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<PhysicalReviewTarget | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await authenticatedFetch('/api/member/physical-orders', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '訂單載入失敗');
      setOrders(result.orders || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '訂單載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

  const handleSoftDelete = async (order: PhysicalOrder) => {
    if (deletingOrderId) return;
    setDeletingOrderId(order.id);
    setMessage('');
    try {
      const response = await authenticatedFetch('/api/member/physical-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, action: 'soft_delete' })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '訂單紀錄刪除失敗');
      setOrders(current => current.map(item => (
        item.id === order.id
          ? { ...item, user_deleted_at: String(result.userDeletedAt || new Date().toISOString()) }
          : item
      )));
      setDeleteConfirmOrder(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '訂單紀錄刪除失敗');
    } finally {
      setDeletingOrderId(null);
    }
  };

  const openReview = (item: PhysicalOrderItem) => {
    setReviewTarget({ item });
    setReviewRating(item.review?.rating || 0);
    setReviewComment(item.review?.comment || '');
  };

  const submitReview = async () => {
    if (!reviewTarget || reviewSaving) return;
    if (!reviewRating || reviewComment.trim().length < 2) {
      setMessage('請完成星級並留下至少 2 個字的使用心得');
      return;
    }
    setReviewSaving(true);
    setMessage('');
    try {
      const response = await authenticatedFetch('/api/member/physical-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: reviewTarget.item.id, rating: reviewRating, comment: reviewComment.trim() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '評價送出失敗');
      setReviewTarget(null);
      setMessage('謝謝您留下真實的商品使用體驗');
      await loadOrders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '評價送出失敗');
    } finally {
      setReviewSaving(false);
    }
  };

  return <section>
    <div className="mb-5 flex items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">實體商品訂單</h2><p className="mt-1 text-xs text-white/40">共 {orders.length} 筆</p></div>
      <button type="button" onClick={() => void loadOrders()} disabled={loading} className="grid h-10 w-10 place-items-center rounded-md border border-white/10 bg-white/5 text-white/65 hover:bg-white/10 disabled:opacity-40" title="重新整理訂單狀態"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
    </div>

    {message && <div className="mb-4 rounded-md border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{message}</div>}
    {loading && orders.length === 0 ? <div className="py-14 text-center text-white/40">訂單載入中...</div> : orders.length === 0 ? <div className="rounded-md border border-white/8 bg-white/[0.03] py-14 text-center"><Store className="mx-auto mb-3 text-white/20" size={36} /><p className="font-semibold text-white/60">目前沒有實體商品訂單</p><Link href="/shop" className="mt-4 inline-flex h-10 items-center rounded-md bg-[#F05A28] px-4 text-sm font-bold text-white">前往一飛通商城</Link></div> : <div className="space-y-4">
      {orders.map(order => {
        const cancelled = order.order_status === 'CANCELLED';
        const deleted = Boolean(order.user_deleted_at);
        const currentProgress = progressIndex(order.order_status);
        return <article key={order.id} className={`overflow-hidden rounded-md border bg-[#17171f] shadow-lg transition-opacity ${deleted ? 'border-red-400/20 opacity-55 grayscale' : 'border-white/8'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-4 py-4">
            <div><p className="font-mono text-xs text-white/40">訂單 #{order.id.slice(0, 8).toUpperCase()}</p><p className="mt-1 text-xs text-white/35">{new Date(order.created_at).toLocaleString('zh-TW')}</p></div>
            <div className="flex items-start gap-2">
              <div className="text-right">
                <span className={`inline-flex rounded px-2.5 py-1 text-xs font-bold ${deleted ? 'bg-red-400/10 text-red-300' : cancelled ? 'bg-red-400/10 text-red-300' : order.order_status === 'COMPLETED' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-200'}`}>{deleted ? '刪除倒數中' : STATUS_LABELS[order.order_status] || order.order_status}</span>
                <p className="mt-2 font-mono font-bold text-[#f5bd61]">NT${Number(order.total_amount).toLocaleString()}</p>
              </div>
              {canMemberDeletePhysicalOrder(order.order_status, order.user_deleted_at) && <button type="button" onClick={() => setDeleteConfirmOrder(order)} className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/5 text-white/45 hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-300" title="刪除訂單紀錄" aria-label="刪除訂單紀錄"><Trash2 size={16} /></button>}
            </div>
          </div>

          {deleted && <div className="border-b border-red-400/15 bg-red-400/8 px-4 py-3 text-xs leading-5 text-red-200">此紀錄已標記刪除，將於 {formatDeleteHideAt(order.user_deleted_at!)} 後從會員中心隱藏。如需恢復請聯絡客服。</div>}

          {!cancelled && <div className="px-4 py-5"><div className="relative grid grid-cols-4"><div className="absolute left-[12.5%] right-[12.5%] top-4 h-px bg-white/10" /><div className="absolute left-[12.5%] top-4 h-px bg-[#F05A28] transition-all" style={{ width: `${(currentProgress / 3) * 75}%` }} />{PROGRESS_STEPS.map((step, index) => { const Icon = step.icon; const reached = index <= currentProgress; return <div key={step.label} className="relative z-10 flex flex-col items-center"><span className={`grid h-8 w-8 place-items-center rounded-full border ${reached ? 'border-[#F05A28] bg-[#F05A28] text-white' : 'border-white/10 bg-[#17171f] text-white/25'}`}><Icon size={14} /></span><span className={`mt-2 text-[11px] font-semibold ${reached ? 'text-white/75' : 'text-white/25'}`}>{step.label}</span></div>; })}</div></div>}

          <div className="space-y-4 border-t border-white/8 px-4 py-4">{order.physical_order_items.map(item => <div key={item.id} className="border-b border-white/6 pb-4 last:border-b-0 last:pb-0"><div className="flex justify-between gap-4"><div className="min-w-0"><p className="font-semibold text-white/90">{item.product_name} × {item.quantity}</p>{item.rental_start_date && item.rental_end_date && <p className="mt-1 flex items-center gap-1.5 text-xs text-cyan-200"><CalendarDays size={13} />{formatDate(item.rental_start_date)} 至 {formatDate(item.rental_end_date)} · {item.rental_days} 天</p>}</div><p className="shrink-0 font-mono text-sm text-white/55">NT${(Number(item.unit_price) * item.quantity).toLocaleString()}</p></div>{order.order_status === 'COMPLETED' && !deleted && item.product_id && <button type="button" onClick={() => openReview(item)} className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-amber-300/20 bg-amber-300/8 px-3 text-xs font-bold text-amber-100 hover:bg-amber-300/15">{item.review ? <Star size={14} fill="currentColor" /> : <MessageSquareText size={14} />}{item.review ? `已評價 ${item.review.rating} 星 · 修改` : '留下商品評價'}</button>}</div>)}</div>

          <div className="border-t border-white/8 bg-black/10 px-4 py-4 text-xs leading-5 text-white/45"><p className="font-semibold text-white/65">{STATUS_DESCRIPTIONS[order.order_status] || '訂單處理中。'}</p><div className="mt-3 grid gap-1 sm:grid-cols-2"><p>付款方式：{paymentLabel(order.payment_method)}</p><p>付款狀態：{order.payment_status === 'PAID' ? '已付款' : order.payment_status === 'REFUNDED' ? '已退款' : '等待付款'}</p><p>配送方式：{order.delivery_method === 'pickup' ? '預約面交' : '宅配'}</p><p>運費：{Number(order.shipping_fee) === 0 ? '免運' : `NT$${Number(order.shipping_fee).toLocaleString()}`}</p><p className="sm:col-span-2">{order.delivery_method === 'pickup' ? '取件資訊' : '收件資訊'}：{order.recipient_name} · {order.recipient_phone}</p><p className="sm:col-span-2">{order.postal_code || ''} {order.shipping_address}</p>{order.shipping_note && <p className="sm:col-span-2 text-cyan-200/70">備註：{order.shipping_note}</p>}</div></div>
        </article>;
      })}
    </div>}

    {reviewTarget && <div className="fixed inset-0 z-[230] grid place-items-center overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-md border border-white/10 bg-[#17171f] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-amber-200/70">已完成訂單</p><h3 className="mt-1 text-xl font-bold">{reviewTarget.item.review ? '查看或修改商品評價' : '感謝您的使用'}</h3></div><button type="button" onClick={() => setReviewTarget(null)} title="關閉" className="grid h-9 w-9 place-items-center rounded-md text-white/45 hover:bg-white/5"><X size={19} /></button></div>
        <p className="mt-4 text-sm leading-6 text-white/60">為提升商品與租借服務品質，邀請您留下真實的使用體驗。您的意見會幫助我們持續進步。</p>
        <p className="mt-3 rounded-md bg-white/5 px-3 py-2 text-sm text-white/65">{reviewTarget.item.product_name}</p>
        <div className="mt-6 flex items-center justify-between"><label className="text-sm font-bold">整體星級</label><span className="text-xs text-white/40">{reviewRating ? `${reviewRating} / 5` : '請評分'}</span></div>
        <RatingStars value={reviewRating} onChange={setReviewRating} />
        <label className="mt-5 block text-sm font-bold">商品與使用心得<textarea value={reviewComment} onChange={event => setReviewComment(event.target.value.slice(0, 1000))} rows={5} placeholder="例如：商品狀況良好、包裝完整，租借與歸還流程很順利。" className="mt-2 w-full resize-none rounded-md border border-white/10 bg-[#0d0d1a] p-3 text-sm font-normal leading-6 text-white outline-none placeholder:text-white/25 focus:border-cyan/40" /></label>
        <div className="mt-1 text-right text-xs text-white/30">{reviewComment.length} / 1000</div>
        <p className="mt-3 text-xs leading-5 text-white/35">送出後可能以「已購買會員」名義顯示於商品頁，不會公開您的 Email。</p>
        <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => setReviewTarget(null)} className="h-11 rounded-md border border-white/10 text-sm font-bold text-white/60 hover:bg-white/5">取消</button><button type="button" onClick={() => void submitReview()} disabled={reviewSaving} className="h-11 rounded-md bg-[#F05A28] text-sm font-bold text-white hover:bg-[#d94f22] disabled:opacity-45">{reviewSaving ? '送出中...' : reviewTarget.item.review ? '儲存修改' : '送出評價'}</button></div>
      </div>
    </div>}

    {deleteConfirmOrder && <div className="fixed inset-0 z-[220] grid place-items-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-md border border-white/10 bg-[#17171f] p-6 shadow-2xl">
        <button type="button" onClick={() => setDeleteConfirmOrder(null)} disabled={deletingOrderId !== null} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-md text-white/45 hover:bg-white/5 hover:text-white" title="關閉"><X size={18} /></button>
        <h3 className="pr-12 text-lg font-bold text-white">刪除訂單紀錄</h3>
        <p className="mt-3 text-sm leading-6 text-white/60">確定要刪除訂單 #{deleteConfirmOrder.id.slice(0, 8).toUpperCase()} 的會員中心紀錄嗎？</p>
        <p className="mt-3 rounded-md border border-amber-300/15 bg-amber-300/8 px-3 py-3 text-xs leading-5 text-amber-100/80">此操作只會隱藏會員中心紀錄，不會取消訂單、退款或釋放租借日期。刪除後會反灰保留 24 小時，如需恢復請聯絡客服。</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setDeleteConfirmOrder(null)} disabled={deletingOrderId !== null} className="h-10 rounded-md border border-white/10 px-4 text-sm font-bold text-white/65 hover:bg-white/5 disabled:opacity-40">取消</button>
          <button type="button" onClick={() => void handleSoftDelete(deleteConfirmOrder)} disabled={deletingOrderId !== null} className="inline-flex h-10 items-center gap-2 rounded-md bg-red-500 px-4 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-40"><Trash2 size={15} />{deletingOrderId ? '處理中...' : '確認刪除'}</button>
        </div>
      </div>
    </div>}
  </section>;
}
