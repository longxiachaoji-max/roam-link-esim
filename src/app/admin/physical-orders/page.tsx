"use client";

import { useCallback, useEffect, useState } from 'react';
import { Banknote, CalendarDays, ChevronDown, ChevronUp, PackageCheck } from 'lucide-react';
import { adminFetch } from '@/lib/admin-fetch';

interface OrderItem {
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
interface Order {
  id: string; created_at: string; customer_email: string; recipient_name: string; recipient_phone: string;
  postal_code: string | null; shipping_address: string; shipping_note: string | null; total_amount: number;
  delivery_method: 'shipping' | 'pickup'; shipping_fee: number;
  payment_method: string; payment_status: string; order_status: string; physical_order_items: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: '等待付款', PENDING_CONFIRMATION: '待確認面交預約', PROCESSING: '訂單成立', STOCK_ISSUE: '庫存異常', SHIPPED: '已出貨', COMPLETED: '已完成', CANCELLED: '已取消'
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })
    .format(new Date(`${value}T00:00:00`));
}

export default function PhysicalOrdersAdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const response = await adminFetch('/api/admin/physical-orders', { cache: 'no-store' });
    const result = await response.json();
    if (response.ok) setOrders(result.orders || []); else setMessage(result.error || '讀取訂單失敗');
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

  const updateStatus = async (id: string, order_status: string) => {
    const response = await adminFetch('/api/admin/physical-orders', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, order_status })
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error || '更新失敗');
    setMessage('訂單狀態已更新');
    await loadOrders();
  };

  const confirmCashPayment = async (id: string) => {
    if (!window.confirm('確認已於面交現場收到這筆訂單的款項？')) return;
    const response = await adminFetch('/api/admin/physical-orders', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'confirm_cash_payment' })
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error || '確認收款失敗');
    setMessage('面交款項已確認，訂單已標記為已付款');
    await loadOrders();
  };

  const confirmPickupReservation = async (id: string) => {
    if (!window.confirm('確認接受這筆面交訂單並保留客戶選擇的租期？')) return;
    const response = await adminFetch('/api/admin/physical-orders', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'confirm_pickup_reservation' })
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error || '確認訂單失敗');
    setMessage('訂單已成立，前台租借日期已保留');
    await loadOrders();
  };

  return (
    <div className="mx-auto max-w-7xl pb-20">
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-white">實體商品訂單</h1>
        <p className="mt-1 text-sm text-white/45">處理收件資訊、備貨與出貨狀態</p>
      </div>
      {message && <div className="mb-5 rounded-md border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">{message}</div>}
      <div className="overflow-hidden rounded-md border border-white/10 bg-[#141426]">
        {loading ? <div className="py-16 text-center text-white/40">載入訂單中...</div> : orders.length === 0 ? (
          <div className="py-16 text-center text-white/45"><PackageCheck className="mx-auto mb-3 opacity-30" size={36} />尚無實體商品訂單</div>
        ) : orders.map(order => (
          <div key={order.id} className="border-b border-white/8 last:border-b-0">
            <div className="grid gap-4 px-5 py-4 lg:grid-cols-[140px_minmax(190px,1fr)_130px_130px_150px_40px] lg:items-center">
              <div><p className="font-mono text-xs text-white/55">{order.id.slice(0, 8)}</p><p className="mt-1 text-xs text-white/35">{new Date(order.created_at).toLocaleString('zh-TW')}</p></div>
              <div className="min-w-0"><p className="truncate font-medium">{order.recipient_name}</p><p className="truncate text-sm text-white/40">{order.customer_email}</p></div>
              <p className="font-mono font-semibold text-amber-300">NT${Number(order.total_amount).toLocaleString()}</p>
              <span className={order.payment_status === 'PAID' ? 'text-sm text-emerald-300' : 'text-sm text-yellow-200'}>{order.payment_status === 'PAID' ? '已付款' : order.payment_method === 'CASH_PICKUP' ? '面交收款' : '等待付款'}</span>
              <select value={order.order_status} onChange={e => updateStatus(order.id, e.target.value)} className="h-9 rounded-md border border-white/12 bg-[#0d0d1a] px-2 text-sm text-white">
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button title="展開訂單" onClick={() => setExpanded(expanded === order.id ? null : order.id)} className="grid h-9 w-9 place-items-center rounded-md text-white/55 hover:bg-white/8">{expanded === order.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
            </div>
            {expanded === order.id && <div className="border-t border-white/8 bg-black/15 px-5 py-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div><p className="mb-2 text-xs font-semibold text-white/35">{order.delivery_method === 'pickup' ? '面交資訊' : '收件資訊'}</p><p>{order.recipient_name} · {order.recipient_phone}</p><p className="mt-1 text-sm text-white/60">{order.delivery_method === 'pickup' ? '預約面交' : '宅配'} · {order.shipping_fee === 0 ? '免運' : `運費 NT$${Number(order.shipping_fee).toLocaleString()}`}</p><p className="mt-1 text-sm text-white/60">{order.postal_code} {order.shipping_address}</p>{order.shipping_note && <p className="mt-2 text-sm text-cyan-200">備註：{order.shipping_note}</p>}</div>
                <div><p className="mb-2 text-xs font-semibold text-white/35">商品內容</p><div className="space-y-3">{order.physical_order_items.map(item => <div key={item.id} className="flex justify-between gap-4 text-sm"><div><span>{item.product_name} × {item.quantity}</span>{item.rental_start_date && item.rental_end_date && <p className="mt-1 flex items-center gap-1.5 text-xs text-cyan-200"><CalendarDays size={13} />{formatDate(item.rental_start_date)} 至 {formatDate(item.rental_end_date)} · 共 {item.rental_days} 天</p>}{item.rental_daily_rate !== null && <p className="mt-1 text-xs text-white/35">每日租金 NT${Number(item.rental_daily_rate).toLocaleString()}</p>}</div><span className="shrink-0 font-mono text-white/60">NT${(Number(item.unit_price) * item.quantity).toLocaleString()}</span></div>)}</div></div>
              </div>
              {order.payment_method === 'CASH_PICKUP' && order.order_status === 'PENDING_CONFIRMATION' && <div className="mt-5 flex flex-col items-end gap-2"><p className="text-xs text-amber-200/70">目前尚未占用租借日期，確認前請先與客戶核對面交時間。</p><button type="button" onClick={() => void confirmPickupReservation(order.id)} className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-500 px-4 text-sm font-bold text-[#071317] hover:bg-cyan-400"><CalendarDays size={16} />確認訂單成立並保留租期</button></div>}
              {order.payment_method === 'CASH_PICKUP' && order.payment_status === 'PENDING' && order.order_status !== 'PENDING_CONFIRMATION' && <div className="mt-5 flex justify-end"><button type="button" onClick={() => void confirmCashPayment(order.id)} className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-400"><Banknote size={16} />確認現場已收款</button></div>}
            </div>}
          </div>
        ))}
      </div>
    </div>
  );
}
