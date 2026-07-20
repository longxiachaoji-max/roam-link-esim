"use client";

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, PackageCheck, RefreshCw, Store, Truck } from 'lucide-react';
import Link from 'next/link';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

interface PhysicalOrderItem {
  id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  rental_start_date: string | null;
  rental_end_date: string | null;
  rental_days: number | null;
  rental_daily_rate: number | null;
}

interface PhysicalOrder {
  id: string;
  created_at: string;
  updated_at: string;
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

export default function PhysicalOrdersPanel() {
  const [orders, setOrders] = useState<PhysicalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

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

  return <section>
    <div className="mb-5 flex items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">實體商品訂單</h2><p className="mt-1 text-xs text-white/40">共 {orders.length} 筆</p></div>
      <button type="button" onClick={() => void loadOrders()} disabled={loading} className="grid h-10 w-10 place-items-center rounded-md border border-white/10 bg-white/5 text-white/65 hover:bg-white/10 disabled:opacity-40" title="重新整理訂單狀態"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
    </div>

    {message && <div className="mb-4 rounded-md border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{message}</div>}
    {loading && orders.length === 0 ? <div className="py-14 text-center text-white/40">訂單載入中...</div> : orders.length === 0 ? <div className="rounded-md border border-white/8 bg-white/[0.03] py-14 text-center"><Store className="mx-auto mb-3 text-white/20" size={36} /><p className="font-semibold text-white/60">目前沒有實體商品訂單</p><Link href="/shop" className="mt-4 inline-flex h-10 items-center rounded-md bg-[#F05A28] px-4 text-sm font-bold text-white">前往一飛通商城</Link></div> : <div className="space-y-4">
      {orders.map(order => {
        const cancelled = order.order_status === 'CANCELLED';
        const currentProgress = progressIndex(order.order_status);
        return <article key={order.id} className="overflow-hidden rounded-md border border-white/8 bg-[#17171f] shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-4 py-4">
            <div><p className="font-mono text-xs text-white/40">訂單 #{order.id.slice(0, 8).toUpperCase()}</p><p className="mt-1 text-xs text-white/35">{new Date(order.created_at).toLocaleString('zh-TW')}</p></div>
            <div className="text-right"><span className={`inline-flex rounded px-2.5 py-1 text-xs font-bold ${cancelled ? 'bg-red-400/10 text-red-300' : order.order_status === 'COMPLETED' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-200'}`}>{STATUS_LABELS[order.order_status] || order.order_status}</span><p className="mt-2 font-mono font-bold text-[#f5bd61]">NT${Number(order.total_amount).toLocaleString()}</p></div>
          </div>

          {!cancelled && <div className="px-4 py-5"><div className="relative grid grid-cols-4"><div className="absolute left-[12.5%] right-[12.5%] top-4 h-px bg-white/10" /><div className="absolute left-[12.5%] top-4 h-px bg-[#F05A28] transition-all" style={{ width: `${(currentProgress / 3) * 75}%` }} />{PROGRESS_STEPS.map((step, index) => { const Icon = step.icon; const reached = index <= currentProgress; return <div key={step.label} className="relative z-10 flex flex-col items-center"><span className={`grid h-8 w-8 place-items-center rounded-full border ${reached ? 'border-[#F05A28] bg-[#F05A28] text-white' : 'border-white/10 bg-[#17171f] text-white/25'}`}><Icon size={14} /></span><span className={`mt-2 text-[11px] font-semibold ${reached ? 'text-white/75' : 'text-white/25'}`}>{step.label}</span></div>; })}</div></div>}

          <div className="space-y-3 border-t border-white/8 px-4 py-4">{order.physical_order_items.map(item => <div key={item.id} className="flex justify-between gap-4"><div className="min-w-0"><p className="font-semibold text-white/90">{item.product_name} × {item.quantity}</p>{item.rental_start_date && item.rental_end_date && <p className="mt-1 flex items-center gap-1.5 text-xs text-cyan-200"><CalendarDays size={13} />{formatDate(item.rental_start_date)} 至 {formatDate(item.rental_end_date)} · {item.rental_days} 天</p>}</div><p className="shrink-0 font-mono text-sm text-white/55">NT${(Number(item.unit_price) * item.quantity).toLocaleString()}</p></div>)}</div>

          <div className="border-t border-white/8 bg-black/10 px-4 py-4 text-xs leading-5 text-white/45"><p className="font-semibold text-white/65">{STATUS_DESCRIPTIONS[order.order_status] || '訂單處理中。'}</p><div className="mt-3 grid gap-1 sm:grid-cols-2"><p>付款方式：{paymentLabel(order.payment_method)}</p><p>付款狀態：{order.payment_status === 'PAID' ? '已付款' : order.payment_status === 'REFUNDED' ? '已退款' : '等待付款'}</p><p>配送方式：{order.delivery_method === 'pickup' ? '預約面交' : '宅配'}</p><p>運費：{Number(order.shipping_fee) === 0 ? '免運' : `NT$${Number(order.shipping_fee).toLocaleString()}`}</p><p className="sm:col-span-2">{order.delivery_method === 'pickup' ? '取件資訊' : '收件資訊'}：{order.recipient_name} · {order.recipient_phone}</p><p className="sm:col-span-2">{order.postal_code || ''} {order.shipping_address}</p>{order.shipping_note && <p className="sm:col-span-2 text-cyan-200/70">備註：{order.shipping_note}</p>}</div></div>
        </article>;
      })}
    </div>}
  </section>;
}
