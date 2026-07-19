"use client";

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, PackageCheck } from 'lucide-react';
import { adminFetch } from '@/lib/admin-fetch';

interface OrderItem { id: string; product_name: string; product_image: string | null; quantity: number; unit_price: number; }
interface Order {
  id: string; created_at: string; customer_email: string; recipient_name: string; recipient_phone: string;
  postal_code: string | null; shipping_address: string; shipping_note: string | null; total_amount: number;
  payment_method: string; payment_status: string; order_status: string; physical_order_items: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: '等待付款', PROCESSING: '備貨中', STOCK_ISSUE: '庫存異常', SHIPPED: '已出貨', COMPLETED: '已完成', CANCELLED: '已取消'
};

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
              <span className={order.payment_status === 'PAID' ? 'text-sm text-emerald-300' : 'text-sm text-yellow-200'}>{order.payment_status === 'PAID' ? '已付款' : '等待付款'}</span>
              <select value={order.order_status} onChange={e => updateStatus(order.id, e.target.value)} className="h-9 rounded-md border border-white/12 bg-[#0d0d1a] px-2 text-sm text-white">
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button title="展開訂單" onClick={() => setExpanded(expanded === order.id ? null : order.id)} className="grid h-9 w-9 place-items-center rounded-md text-white/55 hover:bg-white/8">{expanded === order.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
            </div>
            {expanded === order.id && <div className="border-t border-white/8 bg-black/15 px-5 py-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div><p className="mb-2 text-xs font-semibold text-white/35">收件資訊</p><p>{order.recipient_name} · {order.recipient_phone}</p><p className="mt-1 text-sm text-white/60">{order.postal_code} {order.shipping_address}</p>{order.shipping_note && <p className="mt-2 text-sm text-cyan-200">備註：{order.shipping_note}</p>}</div>
                <div><p className="mb-2 text-xs font-semibold text-white/35">商品內容</p><div className="space-y-2">{order.physical_order_items.map(item => <div key={item.id} className="flex justify-between gap-4 text-sm"><span>{item.product_name} × {item.quantity}</span><span className="font-mono text-white/60">NT${(Number(item.unit_price) * item.quantity).toLocaleString()}</span></div>)}</div></div>
              </div>
            </div>}
          </div>
        ))}
      </div>
    </div>
  );
}
