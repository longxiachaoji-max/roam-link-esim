'use client';

import { adminFetch } from '@/lib/admin-fetch';
import { sanitizeMicroesimUsageForDisplay } from '@/lib/microesim-usage-status';

import { Fragment, useState, useEffect } from 'react';
import { Activity, ChevronDown, RefreshCw, Search } from 'lucide-react';

interface MicroesimUsage {
  status: string;
  usedData: string | null;
  remainingData: string | null;
  totalData: string | null;
  installedAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  installationDeadline: string | null;
}

interface ESimInventory {
  id: string;
  iccid: string | null;
  smdp_address: string | null;
  activation_code: string | null;
  status: string | null;
  cost: number | null;
  expiry_date: string | null;
  microesim_topup_id: string | null;
  microesim_usage_cache: MicroesimUsage | null;
  microesim_usage_checked_at: string | null;
}

interface Product {
  id: string;
  name: string;
  country: string;
  data_amount: string | null;
  validity_days: number;
  supplier: string | null;
  supplier_plan_id: string | null;
  supplier_plan_name: string | null;
  supplier_cost_twd: number | null;
}

interface OrderItem {
  id: string;
  price: number;
  note: string | null;
  user_deleted_at: string | null;
  product_id: string;
  inventory_id: string | null;
  supplier_order_ref: string | null;
  supplier_order_id: string | null;
  supplier_status: string | null;
  supplier_last_checked_at: string | null;
  supplier_error: string | null;
  products: Product | null;
  e_sim_inventory: ESimInventory | null;
}

interface Customer {
  email: string;
  name: string | null;
}

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  total_amount: number;
  tokens_used: number | null;
  payment_method: string | null;
  payment_status: string | null;
  order_status: string;
  customers: Customer | null;
  order_items: OrderItem[];
}

interface TokenTransaction {
  amount: number;
  transaction_type?: string | null;
  reason?: string | null;
  created_at: string;
}

interface InventoryOption {
  id: string;
  iccid: string | null;
  activation_code: string;
  status: string;
  product_id: string;
  products: {
    name: string;
    country: string;
    data_amount: string | null;
  } | null;
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-500/20 text-green-400 border border-green-500/30';
    case 'PENDING':
      return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    case 'CREATED':
      return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    case 'CANCELLED':
      return 'bg-red-500/20 text-red-400 border border-red-500/30';
    default:
      return 'bg-white/10 text-white/60 border border-white/20';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return '已完成';
    case 'PENDING':
      return '待處理';
    case 'CREATED':
      return '已建立';
    case 'CANCELLED':
      return '已取消';
    default:
      return status;
  }
};

const getPaymentMethodLabel = (method: string | null) => {
  if (method === 'ECPAY') return '綠界付款';
  if (method === 'ECPAY_TOPUP') return '綠界儲值';
  if (method === 'TOKENS') return '儲值金';
  return method || '-';
};

const getPaymentStatusLabel = (status: string | null) => {
  if (status === 'PAID') return '已付款';
  if (status === 'PENDING') return '等待付款';
  if (status === 'REFUNDED') return '已退款';
  if (status === 'FAILED') return '付款失敗';
  return status || '-';
};

const getUsageBadgeClass = (status: string) => {
  if (status === '已啟用') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  if (status === '已安裝') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200';
  if (status === '已下載') return 'border-blue-500/30 bg-blue-500/10 text-blue-200';
  if (status === '已到期' || status === '已停用' || status === '已刪除') {
    return 'border-red-500/30 bg-red-500/10 text-red-200';
  }
  return 'border-white/15 bg-white/5 text-white/55';
};

const formatUsageTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW');
};

const RECEIVED_AMOUNT_PATTERN = /\[收款金額:(\d+(?:\.\d+)?)\]/;

function getReceivedRevenue(transaction: TokenTransaction) {
  const amount = Number(transaction.amount || 0);
  const reason = transaction.reason || '';
  const receivedMatch = reason.match(RECEIVED_AMOUNT_PATTERN);

  if (receivedMatch) {
    return Number(receivedMatch[1] || 0);
  }

  if (transaction.transaction_type === 'purchase' || amount <= 0) {
    return 0;
  }

  // 舊資料沒有收款標記時，保留手動加值的正數金額；兌換碼等贈送不列營收。
  if (reason.includes('兌換代碼') || reason.includes('遊樂場') || reason.includes('獎勵')) {
    return 0;
  }

  return amount;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOption[]>([]);
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({});
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null);
  const [fulfillingMicroItemId, setFulfillingMicroItemId] = useState<string | null>(null);
  const [checkingStatusItemId, setCheckingStatusItemId] = useState<string | null>(null);
  const [restoringItemId, setRestoringItemId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchOrders = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await adminFetch('/api/admin/orders');
      const json = await res.json();
      if (json.orders) {
        setOrders(json.orders);
      }

      const txRes = await adminFetch('/api/admin/topup-history');
      const txJson = await txRes.json();
      if (Array.isArray(txJson)) {
        setTransactions(txJson);
      }

      const invRes = await adminFetch('/api/admin/esim-inventory');
      const invJson = await invRes.json();
      if (invJson.inventory) {
        setInventoryOptions(invJson.inventory.filter((item: InventoryOption) => item.status === 'AVAILABLE'));
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchOrders(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.order_status === 'COMPLETED').length;
  const pendingOrders = orders.filter(o => o.order_status === 'PENDING').length;
  const pendingFulfillmentCount = orders.reduce(
    (sum, order) => sum + (order.payment_status === 'PAID'
      ? order.order_items.filter(item => !item.inventory_id).length
      : 0),
    0
  );

  // 計算毛利
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const calcProfit = (filterFn: (d: Date) => boolean) => {
    let revenue = 0;
    let cost = 0;

    for (const transaction of transactions) {
      const transactionDate = new Date(transaction.created_at);
      if (!filterFn(transactionDate)) continue;
      revenue += getReceivedRevenue(transaction);
    }

    for (const order of orders) {
      const orderDate = new Date(order.created_at);
      if (!filterFn(orderDate)) continue;
      // 綠界信用卡訂單直接列營收；儲值金結帳不重複列營收。
      if (order.payment_method === 'ECPAY' && order.payment_status === 'PAID') {
        revenue += Number(order.total_amount || 0);
      }
      for (const item of order.order_items || []) {
        cost += Number(item.e_sim_inventory?.cost || 0);
      }
    }
    return { revenue, cost, profit: revenue - cost };
  };

  const monthlyProfit = calcProfit(d => d.getMonth() === currentMonth && d.getFullYear() === currentYear);
  const yearlyProfit = calcProfit(d => d.getFullYear() === currentYear);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredOrders = orders.filter(order => {
    if (statusFilter !== 'ALL' && order.order_status !== statusFilter) return false;
    if (!normalizedSearch) return true;
    const searchable = [
      order.order_number,
      order.id,
      order.customers?.email,
      order.customers?.name,
      ...order.order_items.flatMap(item => [
        item.products?.name,
        item.products?.country,
        item.e_sim_inventory?.iccid
      ])
    ].filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(normalizedSearch);
  });

  // Flatten filtered orders to rows for the desktop table.
  const flatRows = filteredOrders.flatMap(order =>
    order.order_items.length > 0
      ? order.order_items.map((item, idx) => ({ order, item: item as OrderItem | null, isFirst: idx === 0, itemCount: order.order_items.length }))
      : [{ order, item: null as OrderItem | null, isFirst: true, itemCount: 0 }]
  );

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(prev => (prev === orderId ? null : orderId));
  };

  const truncate = (str: string | null | undefined, maxLen: number) => {
    if (!str) return '-';
    return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
  };

  const getAvailableInventoryForItem = (item: OrderItem | null) => {
    if (!item?.product_id) return [];
    return inventoryOptions.filter(inventory => {
      const status = inventory.status || '';
      return inventory.product_id === item.product_id && (status === 'AVAILABLE' || status === '可使用');
    });
  };

  const handleAssignInventory = async (item: OrderItem) => {
    const inventoryId = assignSelections[item.id];
    if (!inventoryId) {
      alert('請先選擇一筆可用 eSIM');
      return;
    }

    setAssigningItemId(item.id);
    try {
      const res = await adminFetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: item.id,
          inventory_id: inventoryId
        })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '補上 eSIM 失敗');
      setAssignSelections(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      await fetchOrders(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '補上 eSIM 失敗');
    } finally {
      setAssigningItemId(null);
    }
  };

  const handleFulfillMicroesim = async (item: OrderItem) => {
    const ok = window.confirm(`要透過 MicroEsim 自動配發這筆 eSIM 嗎？\n\n商品：${item.products?.name || '未知商品'}`);
    if (!ok) return;

    setFulfillingMicroItemId(item.id);
    try {
      const res = await adminFetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: item.id,
          action: 'fulfill_microesim'
        })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'MicroEsim 自動配發失敗');
      await fetchOrders(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'MicroEsim 自動配發失敗');
    } finally {
      setFulfillingMicroItemId(null);
    }
  };

  const handleRefreshEsimStatus = async (item: OrderItem) => {
    setCheckingStatusItemId(item.id);
    try {
      const res = await adminFetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: item.id,
          action: 'refresh_esim_status'
        })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '查詢安裝狀態失敗');
      setOrders(currentOrders => currentOrders.map(order => ({
        ...order,
        order_items: order.order_items.map(orderItem => (
          orderItem.id === item.id && orderItem.e_sim_inventory
            ? {
                ...orderItem,
                e_sim_inventory: {
                  ...orderItem.e_sim_inventory,
                  microesim_usage_cache: json.usage,
                  microesim_usage_checked_at: json.checkedAt
                }
              }
            : orderItem
        ))
      })));
      if (json.warning) alert(`已顯示上次查詢結果\n${json.warning}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '查詢安裝狀態失敗');
    } finally {
      setCheckingStatusItemId(null);
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    const customer = order.customers?.email || '未知客戶';
    const cancellationNote = order.payment_method === 'DEALER_BALANCE'
      ? '經銷餘額會自動退回；已寄出的 eSIM 不會重新上架。'
      : '已配發的 eSIM 會退回可用庫存。';
    const ok = window.confirm(
      `確定要取消這筆訂單嗎？\n\n客戶：${customer}\n訂單：${order.order_number || order.id}\n\n${cancellationNote}`
    );
    if (!ok) return;

    setDeletingOrderId(order.id);
    try {
      const res = await adminFetch('/api/admin/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '取消訂單失敗');
      setExpandedOrderId(prev => (prev === order.id ? null : prev));
      await fetchOrders(false);
      if (json.refundedAmount) alert(`訂單已取消，經銷餘額已退回 NT$${Number(json.refundedAmount).toLocaleString('zh-TW')}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '取消訂單失敗');
    } finally {
      setDeletingOrderId(null);
    }
  };

  const handleRestoreDeletedItem = async (item: OrderItem) => {
    const ok = window.confirm(`確定要恢復這筆 eSIM 到客戶會員中心嗎？\n\n商品：${item.products?.name || '未知商品'}`);
    if (!ok) return;

    setRestoringItemId(item.id);
    try {
      const res = await adminFetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: item.id,
          action: 'restore_deleted'
        })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '恢復失敗');
      await fetchOrders(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '恢復失敗');
    } finally {
      setRestoringItemId(null);
    }
  };

  const renderAssignControls = (item: OrderItem, compact = false) => {
    const cachedUsage = item.e_sim_inventory?.microesim_usage_cache;
    const usage = cachedUsage ? sanitizeMicroesimUsageForDisplay(cachedUsage) : null;
    const canRefreshStatus = Boolean(
      item.e_sim_inventory?.microesim_topup_id && item.e_sim_inventory?.iccid
    );

    if (item.inventory_id) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-green-400 text-xs">已配發</span>
          {usage?.status && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${getUsageBadgeClass(usage.status)}`}>
              <Activity size={12} />
              {usage.status}
            </span>
          )}
          {canRefreshStatus && (
            <button
              type="button"
              onClick={() => handleRefreshEsimStatus(item)}
              disabled={checkingStatusItemId === item.id}
              className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-bold text-cyan-100 hover:bg-cyan-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
            >
              <RefreshCw size={13} className={checkingStatusItemId === item.id ? 'animate-spin' : ''} />
              {checkingStatusItemId === item.id ? '查詢中' : '查詢用量'}
            </button>
          )}
        </div>
      );
    }

    const availableInventory = getAvailableInventoryForItem(item);
    const canAutoFulfillMicro = Boolean(item.products?.supplier_plan_id);
    if (availableInventory.length === 0) {
      return (
        <div className="flex flex-col items-start gap-2">
          <span className="text-yellow-300/80 text-xs">
            {item.supplier_status === 'PROCESSING' || item.supplier_status === 'SUBMITTING'
              ? 'Micro 配發中，開啟本頁會自動補查'
              : item.supplier_status === 'FAILED'
                ? 'Micro 下單失敗'
                : '待補庫存'}
          </span>
          {item.supplier_order_ref && (
            <span className="font-mono text-[11px] text-white/40">對帳 {item.supplier_order_ref}</span>
          )}
          {item.supplier_order_id && (
            <span className="font-mono text-[11px] text-white/35">Micro {item.supplier_order_id}</span>
          )}
          {item.supplier_error && (
            <span className="max-w-[280px] text-[11px] text-red-300/70">{item.supplier_error}</span>
          )}
          {canAutoFulfillMicro && (
            <button
              type="button"
              onClick={() => handleFulfillMicroesim(item)}
              disabled={fulfillingMicroItemId === item.id}
              className={`${compact ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-lg border border-sky-500/30 bg-sky-500/10 text-xs font-bold text-sky-200 hover:bg-sky-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30`}
            >
              {fulfillingMicroItemId === item.id
                ? '查詢中...'
                : item.supplier_order_id
                  ? '立即查詢 Micro'
                  : item.supplier_status === 'FAILED'
                    ? '重新送出 Micro'
                    : '自動配發 Micro'}
            </button>
          )}
        </div>
      );
    }

    return (
      <div className={`flex ${compact ? 'items-center' : 'items-stretch sm:items-center'} gap-2 ${compact ? '' : 'flex-col sm:flex-row'}`}>
        <select
          className={`${compact ? 'max-w-[180px]' : 'w-full sm:max-w-[280px]'} bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white min-w-0`}
          value={assignSelections[item.id] || ''}
          onChange={(e) => setAssignSelections(prev => ({ ...prev, [item.id]: e.target.value }))}
        >
          <option value="" className="text-black">選擇 eSIM</option>
          {availableInventory.map(inventory => (
            <option key={inventory.id} value={inventory.id} className="text-black">
              {inventory.iccid || truncate(inventory.activation_code, 18)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => handleAssignInventory(item)}
          disabled={assigningItemId === item.id}
          className={`${compact ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:text-gray-400 text-white text-xs font-bold whitespace-nowrap`}
        >
          {assigningItemId === item.id ? '補上中...' : '補上 eSIM'}
        </button>
        {canAutoFulfillMicro && (
          <button
            type="button"
            onClick={() => handleFulfillMicroesim(item)}
            disabled={fulfillingMicroItemId === item.id}
            className={`${compact ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-lg border border-sky-500/30 bg-sky-500/10 text-xs font-bold text-sky-200 hover:bg-sky-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30 whitespace-nowrap`}
          >
            {fulfillingMicroItemId === item.id ? '配發中...' : '自動配發 Micro'}
          </button>
        )}
      </div>
    );
  };

  const renderEsimUsage = (item: OrderItem) => {
    const inventory = item.e_sim_inventory;
    if (!inventory) return null;
    const usage = inventory.microesim_usage_cache
      ? sanitizeMicroesimUsageForDisplay(inventory.microesim_usage_cache)
      : null;
    const canRefreshStatus = Boolean(inventory.microesim_topup_id && inventory.iccid);

    return (
      <div className="mt-3 border-t border-white/10 pt-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-white/45">安裝狀態</span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${getUsageBadgeClass(usage?.status || '尚未查詢')}`}>
            <Activity size={12} />
            {usage?.status || '尚未查詢'}
          </span>
          {canRefreshStatus && (
            <button
              type="button"
              onClick={() => handleRefreshEsimStatus(item)}
              disabled={checkingStatusItemId === item.id}
              className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 font-bold text-cyan-100 hover:bg-cyan-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
            >
              <RefreshCw size={13} className={checkingStatusItemId === item.id ? 'animate-spin' : ''} />
              {checkingStatusItemId === item.id ? '查詢中' : '查詢用量'}
            </button>
          )}
          {!canRefreshStatus && (
            <span className="text-white/30">手動庫存或舊訂單無法向供應商查詢</span>
          )}
        </div>
        {usage && (
          <div className="mt-3 grid gap-x-6 gap-y-2 text-white/45 sm:grid-cols-2 lg:grid-cols-3">
            <p>下載／安裝時間：<span className="text-white/70">{formatUsageTime(usage.installedAt)}</span></p>
            <p>啟用時間：<span className="text-white/70">{formatUsageTime(usage.activatedAt)}</span></p>
            {usage.expiresAt ? (
              <p>方案到期日：<span className="text-white/70">{formatUsageTime(usage.expiresAt)}</span></p>
            ) : (
              <p>最晚安裝期限：<span className="text-white/70">{formatUsageTime(usage.installationDeadline)}</span></p>
            )}
            <p>已用流量：<span className="text-white/70">{usage.usedData || '-'}</span></p>
            <p>最後查詢：<span className="text-white/70">{formatUsageTime(inventory.microesim_usage_checked_at)}</span></p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-white">訂單管理</h1>
      </div>

      {pendingFulfillmentCount > 0 && (
        <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="font-bold">有 {pendingFulfillmentCount} 筆商品尚未補上 eSIM</p>
              <p className="text-sm text-yellow-100/70 mt-1">展開訂單後，在商品明細下方選擇 eSIM，再按「補上 eSIM」。</p>
            </div>
          </div>
        </div>
      )}

      {/* Profit Cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-6">
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4 sm:p-6">
          <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-emerald-400/70">📅 {currentMonth + 1}月份毛利</p>
            <p className="text-xs text-white/30">儲值收款 NT${monthlyProfit.revenue.toLocaleString()} − eSIM 成本 NT${monthlyProfit.cost.toLocaleString()}</p>
          </div>
          <p className={`text-2xl font-black sm:text-3xl ${monthlyProfit.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            NT$ {monthlyProfit.profit.toLocaleString()}
          </p>
        </div>
        <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-4 sm:p-6">
          <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-blue-400/70">📊 {currentYear} 年度毛利</p>
            <p className="text-xs text-white/30">儲值收款 NT${yearlyProfit.revenue.toLocaleString()} − eSIM 成本 NT${yearlyProfit.cost.toLocaleString()}</p>
          </div>
          <p className={`text-2xl font-black sm:text-3xl ${yearlyProfit.profit >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            NT$ {yearlyProfit.profit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-6">
        <div className="flex items-center justify-center rounded-md border border-white/10 bg-white/5 p-3 sm:justify-start sm:p-6">
          <div className="mr-4 hidden rounded-full bg-blue-500/20 p-3 text-blue-400 sm:block">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-center text-xs font-medium text-white/50 sm:text-left sm:text-sm">總訂單</p>
            <p className="text-center text-xl font-bold text-white sm:text-left sm:text-2xl">{totalOrders}</p>
          </div>
        </div>

        <div className="flex items-center justify-center rounded-md border border-white/10 bg-white/5 p-3 sm:justify-start sm:p-6">
          <div className="mr-4 hidden rounded-full bg-green-500/20 p-3 text-green-400 sm:block">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-center text-xs font-medium text-white/50 sm:text-left sm:text-sm">已完成</p>
            <p className="text-center text-xl font-bold text-white sm:text-left sm:text-2xl">{completedOrders}</p>
          </div>
        </div>

        <div className="flex items-center justify-center rounded-md border border-white/10 bg-white/5 p-3 sm:justify-start sm:p-6">
          <div className="mr-4 hidden rounded-full bg-yellow-500/20 p-3 text-yellow-400 sm:block">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-center text-xs font-medium text-white/50 sm:text-left sm:text-sm">待處理</p>
            <p className="text-center text-xl font-bold text-white sm:text-left sm:text-2xl">{pendingOrders}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={17} />
          <span className="sr-only">搜尋訂單</span>
          <input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="搜尋訂單、Email、商品或 ICCID"
            className="h-11 w-full rounded-md border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/50"
          />
        </label>
        <label>
          <span className="sr-only">訂單狀態</span>
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            className="h-11 w-full rounded-md border border-white/10 bg-[#17172a] px-3 text-sm text-white outline-none focus:border-cyan-400/50"
          >
            <option value="ALL">全部狀態</option>
            <option value="CREATED">已建立</option>
            <option value="PENDING">待處理</option>
            <option value="COMPLETED">已完成</option>
            <option value="CANCELLED">已取消</option>
          </select>
        </label>
      </div>

      <p className="mb-3 text-xs text-white/35">顯示 {filteredOrders.length} 筆訂單</p>

      {/* Mobile order cards */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="border-y border-white/10 py-12 text-center text-sm text-white/45">訂單載入中...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="border-y border-white/10 py-12 text-center text-sm text-white/45">沒有符合條件的訂單</div>
        ) : filteredOrders.map(order => {
          const expanded = expandedOrderId === order.id;
          const productNames = order.order_items.map(item => item.products?.name || '未知商品');

          return (
            <article key={order.id} className="overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-white/40">{new Date(order.created_at).toLocaleString('zh-TW')}</p>
                    <p className="mt-1 break-all font-mono text-xs text-white/65">{order.order_number || order.id}</p>
                  </div>
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(order.order_status)}`}>
                    {getStatusLabel(order.order_status)}
                  </span>
                </div>

                <p className="mt-3 break-all text-sm font-semibold text-white/85">{order.customers?.email || '-'}</p>
                <p className="mt-1 text-xs text-white/40">{order.customers?.name || '未填會員名稱'}</p>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/8 pt-3">
                  <div>
                    <p className="text-xs text-white/35">訂單金額</p>
                    <p className="mt-1 font-bold text-white">NT${(Number(order.total_amount || 0) + Number(order.tokens_used || 0)).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/35">商品項目</p>
                    <p className="mt-1 font-bold text-white">{order.order_items.length} 項</p>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-xs leading-5 text-white/55">{productNames.join('、') || '沒有商品明細'}</p>
              </div>

              <button
                type="button"
                onClick={() => toggleExpand(order.id)}
                aria-expanded={expanded}
                className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-white/8 bg-black/10 px-4 text-sm font-bold text-cyan-100"
              >
                {expanded ? '收起訂單' : '查看與處理'}
                <ChevronDown size={17} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {expanded && (
                <div className="border-t border-white/8 bg-black/10 px-4 pb-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 text-xs">
                    <div><dt className="text-white/35">付款方式</dt><dd className="mt-1 text-white/70">{getPaymentMethodLabel(order.payment_method)}</dd></div>
                    <div><dt className="text-white/35">付款狀態</dt><dd className="mt-1 text-white/70">{getPaymentStatusLabel(order.payment_status)}</dd></div>
                  </dl>

                  <div className="border-t border-white/8">
                    {order.order_items.map((item, index) => (
                      <section key={item.id} className={`py-4 ${index > 0 ? 'border-t border-white/8' : ''} ${item.user_deleted_at ? 'opacity-55' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-bold text-white/85">{item.products?.name || '未知商品'}</p>
                            <p className="mt-1 text-xs leading-5 text-white/45">
                              {item.products?.country || '-'} · {item.products?.data_amount || '-'} · {item.products?.validity_days || '-'} 天
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-white/75">NT${Number(item.price || 0).toLocaleString()}</p>
                        </div>

                        {item.e_sim_inventory ? (
                          <div className="mt-3 space-y-1.5 text-xs text-white/45">
                            <p className="break-all"><span className="text-white/30">ICCID：</span>{item.e_sim_inventory.iccid || '-'}</p>
                            <p className="break-all"><span className="text-white/30">SM-DP+：</span>{item.e_sim_inventory.smdp_address || '-'}</p>
                            <p className="break-all"><span className="text-white/30">啟用碼：</span>{item.e_sim_inventory.activation_code || '-'}</p>
                            {renderEsimUsage(item)}
                          </div>
                        ) : (
                          <div className="mt-3 border-l-2 border-yellow-400/40 pl-3">
                            <p className="mb-2 text-xs text-yellow-100/70">尚未配發 eSIM，會員中心會顯示處理中</p>
                            {renderAssignControls(item)}
                          </div>
                        )}

                        {item.user_deleted_at && (
                          <button
                            type="button"
                            onClick={() => handleRestoreDeletedItem(item)}
                            disabled={restoringItemId === item.id}
                            className="mt-3 min-h-10 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-200 disabled:opacity-40"
                          >
                            {restoringItemId === item.id ? '恢復中...' : '恢復客戶顯示'}
                          </button>
                        )}
                      </section>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteOrder(order)}
                    disabled={deletingOrderId === order.id}
                    className="mt-2 min-h-11 w-full rounded-md border border-red-500/30 bg-red-500/10 px-4 text-sm font-bold text-red-200 disabled:opacity-40"
                  >
                    {deletingOrderId === order.id ? '刪除中...' : '刪除這筆訂單'}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Orders Table */}
      <div className="hidden overflow-hidden rounded-md border border-white/10 bg-white/5 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">訂購日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">客戶帳號</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">商品名稱</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">ICCID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">啟用碼</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">金額</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">狀態</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">處理</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-sm text-white/50">載入中...</td>
                </tr>
              ) : flatRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-sm text-white/50">尚無任何訂單</td>
                </tr>
              ) : (
                flatRows.map(({ order, item, isFirst, itemCount }, idx) => (
                  <Fragment key={`wrap-${order.id}-${item?.id ?? 'empty'}-${idx}`}>
                    <tr key={`row-${order.id}-${item?.id ?? 'empty'}-${idx}`} className="hover:bg-white/5 transition-colors">
                      {/* Expand button - only on first row of each order */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {isFirst && itemCount > 0 ? (
                          <button
                            onClick={() => toggleExpand(order.id)}
                            className="text-white/40 hover:text-white/80 transition-colors"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className={`h-4 w-4 transform transition-transform ${expandedOrderId === order.id ? 'rotate-90' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white/90">
                        {isFirst ? new Date(order.created_at).toLocaleString('zh-TW') : ''}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white/90">
                        {isFirst ? (order.customers?.email || '-') : ''}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white/90">
                        <div>{item?.products?.name || '-'}</div>
                        {item && !item.inventory_id && (
                          <div className="mt-1 text-xs text-yellow-300/80">待補 eSIM</div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white/60 font-mono text-xs">
                        {item?.e_sim_inventory?.iccid || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white/60 font-mono text-xs" title={item?.e_sim_inventory?.activation_code || ''}>
                        {truncate(item?.e_sim_inventory?.activation_code, 20)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white/90 font-medium">
                        {isFirst ? `NT$${Number(order.total_amount || 0) + Number(order.tokens_used || 0)}` : ''}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {isFirst ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(order.order_status)}`}>
                            {getStatusLabel(order.order_status)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-sm min-w-[280px]">
                        <div className="flex flex-col gap-2">
                          {item ? renderAssignControls(item, true) : '-'}
                          {item?.user_deleted_at && (
                            <button
                              onClick={() => handleRestoreDeletedItem(item)}
                              disabled={restoringItemId === item.id}
                              className="self-start rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
                            >
                              {restoringItemId === item.id ? '恢復中...' : '恢復顯示'}
                            </button>
                          )}
                          {isFirst && order.order_status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleDeleteOrder(order)}
                              disabled={deletingOrderId === order.id}
                              className="self-start rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200 hover:bg-red-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
                            >
                              {deletingOrderId === order.id ? '取消中...' : '取消訂單'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded detail row */}
                    {isFirst && expandedOrderId === order.id && (
                      <tr key={`detail-${order.id}`}>
                        <td colSpan={9} className="px-6 py-4 bg-white/[0.02]">
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-white/40">訂單編號</span>
                                <p className="text-white/80 font-mono text-xs mt-1">{order.order_number || order.id}</p>
                                <p className="text-white/30 font-mono text-[10px] mt-1" title="系統內部識別碼">{order.id}</p>
                              </div>
                              <div>
                                <span className="text-white/40">客戶名稱</span>
                                <p className="text-white/80 mt-1">{order.customers?.name || '-'}</p>
                              </div>
                              <div>
                                <span className="text-white/40">付款方式</span>
                                <p className="text-white/80 mt-1">{order.payment_method || '-'}</p>
                              </div>
                              <div>
                                <span className="text-white/40">付款狀態</span>
                                <p className="text-white/80 mt-1">{order.payment_status || '-'}</p>
                              </div>
                              {order.tokens_used != null && order.tokens_used > 0 && (
                                <div>
                                  <span className="text-white/40">使用代幣</span>
                                  <p className="text-white/80 mt-1">{order.tokens_used}</p>
                                </div>
                              )}
                            </div>

                            <div className="flex justify-end">
                              <button
                                onClick={() => handleDeleteOrder(order)}
                                disabled={deletingOrderId === order.id}
                                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
                              >
                                {deletingOrderId === order.id ? '刪除中...' : '刪除這筆訂單'}
                              </button>
                            </div>

                            {/* Order Items Detail */}
                            <div className="mt-4">
                              <h4 className="text-sm font-medium text-white/50 mb-2">訂單明細 ({order.order_items.length} 項)</h4>
                              <div className="space-y-2">
                                {order.order_items.map((oi) => (
                                  <div
                                    key={oi.id}
                                    className={`bg-white/5 border border-white/10 rounded-lg p-3 text-sm ${oi.user_deleted_at ? 'opacity-50' : ''}`}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="space-y-1">
                                        <p className="text-white/90 font-medium">
                                          {oi.products?.name || '未知商品'}
                                          {oi.user_deleted_at && <span className="text-red-400 text-xs ml-2">(已刪除)</span>}
                                        </p>
                                        {oi.user_deleted_at && (
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-red-300/70 text-xs">
                                              客戶於 {new Date(oi.user_deleted_at).toLocaleString('zh-TW')} 刪除，24 小時內會員中心會反灰保留。
                                            </p>
                                            <button
                                              onClick={() => handleRestoreDeletedItem(oi)}
                                              disabled={restoringItemId === oi.id}
                                              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
                                            >
                                              {restoringItemId === oi.id ? '恢復中...' : '恢復顯示'}
                                            </button>
                                          </div>
                                        )}
                                        <p className="text-white/50 text-xs">
                                          {oi.products?.country || '-'} · {oi.products?.data_amount || '-'} · {oi.products?.validity_days || '-'}天
                                        </p>
                                        {oi.e_sim_inventory && (
                                          <div className="text-xs text-white/40 font-mono space-y-0.5 mt-1">
                                            <p>ICCID: {oi.e_sim_inventory?.iccid || '-'}</p>
                                            <p>SMDP: {oi.e_sim_inventory?.smdp_address || '-'}</p>
                                            <p>啟用碼: {oi.e_sim_inventory?.activation_code || '-'}</p>
                                            <p>eSIM 狀態: {oi.e_sim_inventory?.status || '-'}</p>
                                          </div>
                                        )}
                                        {renderEsimUsage(oi)}
                                        {!oi.e_sim_inventory && (
                                          <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                                            <p className="text-yellow-100/80 text-xs mb-2">尚未配發 eSIM，客戶會員頁會顯示處理中</p>
                                            {renderAssignControls(oi)}
                                          </div>
                                        )}
                                        {oi.note && <p className="text-white/40 text-xs mt-1">備註: {oi.note}</p>}
                                      </div>
                                      <p className="text-white/80 font-medium">NT${oi.price}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
