'use client';

import { Fragment, useState, useEffect } from 'react';

interface ESimInventory {
  iccid: string | null;
  smdp_address: string | null;
  activation_code: string | null;
  status: string | null;
  cost: number | null;
}

interface Product {
  id: string;
  name: string;
  country: string;
  data_amount: string | null;
  validity_days: number;
}

interface OrderItem {
  id: string;
  price: number;
  note: string | null;
  user_deleted_at: string | null;
  product_id: string;
  inventory_id: string | null;
  products: Product | null;
  e_sim_inventory: ESimInventory | null;
}

interface Customer {
  email: string;
  name: string | null;
}

interface Order {
  id: string;
  created_at: string;
  total_amount: number;
  tokens_used: number | null;
  payment_method: string | null;
  payment_status: string | null;
  order_status: string;
  customers: Customer | null;
  order_items: OrderItem[];
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOption[]>([]);
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({});
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/orders');
      const json = await res.json();
      if (json.orders) {
        setOrders(json.orders);
      }

      const invRes = await fetch('/api/admin/esim-inventory');
      const invJson = await invRes.json();
      if (invJson.inventory) {
        setInventoryOptions(invJson.inventory.filter((item: InventoryOption) => item.status === 'AVAILABLE'));
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.order_status === 'COMPLETED').length;
  const pendingOrders = orders.filter(o => o.order_status === 'PENDING').length;
  const pendingFulfillmentCount = orders.reduce(
    (sum, order) => sum + order.order_items.filter(item => !item.inventory_id).length,
    0
  );

  // 計算毛利
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const calcProfit = (filterFn: (d: Date) => boolean) => {
    let revenue = 0;
    let cost = 0;
    for (const order of orders) {
      const orderDate = new Date(order.created_at);
      if (!filterFn(orderDate)) continue;
      // 營收 = total_amount (現金) + tokens_used (代幣折抵)
      revenue += Number(order.total_amount || 0) + Number(order.tokens_used || 0);
      // 成本 = 加總各 order_item 的 eSIM 成本
      for (const item of order.order_items || []) {
        cost += Number(item.e_sim_inventory?.cost || 0);
      }
    }
    return { revenue, cost, profit: revenue - cost };
  };

  const monthlyProfit = calcProfit(d => d.getMonth() === currentMonth && d.getFullYear() === currentYear);
  const yearlyProfit = calcProfit(d => d.getFullYear() === currentYear);

  // Flatten orders to rows: one row per order_item
  const flatRows = orders.flatMap(order =>
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
      const res = await fetch('/api/admin/orders', {
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
      await fetchOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : '補上 eSIM 失敗');
    } finally {
      setAssigningItemId(null);
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    const customer = order.customers?.email || '未知客戶';
    const ok = window.confirm(
      `確定要刪除這筆訂單嗎？\n\n客戶：${customer}\n訂單：${order.id}\n\n已配發的 eSIM 會退回可用庫存。`
    );
    if (!ok) return;

    setDeletingOrderId(order.id);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '刪除訂單失敗');
      setExpandedOrderId(prev => (prev === order.id ? null : prev));
      await fetchOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : '刪除訂單失敗');
    } finally {
      setDeletingOrderId(null);
    }
  };

  const renderAssignControls = (item: OrderItem, compact = false) => {
    if (item.inventory_id) {
      return <span className="text-green-400 text-xs">已配發</span>;
    }

    const availableInventory = getAvailableInventoryForItem(item);
    if (availableInventory.length === 0) {
      return <span className="text-yellow-300/80 text-xs">待補庫存</span>;
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
          onClick={() => handleAssignInventory(item)}
          disabled={assigningItemId === item.id}
          className={`${compact ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:text-gray-400 text-white text-xs font-bold whitespace-nowrap`}
        >
          {assigningItemId === item.id ? '補上中...' : '補上 eSIM'}
        </button>
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
              <p className="text-sm text-yellow-100/70 mt-1">點訂單最左邊箭頭展開，在商品明細下方選擇 eSIM 後按「補上 eSIM」。</p>
            </div>
          </div>
        </div>
      )}

      {/* Profit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-900/5 rounded-xl border border-emerald-500/20 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-emerald-400/70">📅 {currentMonth + 1}月份毛利</p>
            <p className="text-xs text-white/30">營收 NT${monthlyProfit.revenue.toLocaleString()} − 成本 NT${monthlyProfit.cost.toLocaleString()}</p>
          </div>
          <p className={`text-3xl font-black ${monthlyProfit.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            NT$ {monthlyProfit.profit.toLocaleString()}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 rounded-xl border border-blue-500/20 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-blue-400/70">📊 {currentYear} 年度毛利</p>
            <p className="text-xs text-white/30">營收 NT${yearlyProfit.revenue.toLocaleString()} − 成本 NT${yearlyProfit.cost.toLocaleString()}</p>
          </div>
          <p className={`text-3xl font-black ${yearlyProfit.profit >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            NT$ {yearlyProfit.profit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex items-center backdrop-blur-sm">
          <div className="p-3 rounded-full bg-blue-500/20 text-blue-400 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white/50">總訂單數</p>
            <p className="text-2xl font-bold text-white">{totalOrders}</p>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex items-center backdrop-blur-sm">
          <div className="p-3 rounded-full bg-green-500/20 text-green-400 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white/50">已完成訂單</p>
            <p className="text-2xl font-bold text-white">{completedOrders}</p>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex items-center backdrop-blur-sm">
          <div className="p-3 rounded-full bg-yellow-500/20 text-yellow-400 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white/50">待處理訂單</p>
            <p className="text-2xl font-bold text-white">{pendingOrders}</p>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
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
                          {isFirst && (
                            <button
                              onClick={() => handleDeleteOrder(order)}
                              disabled={deletingOrderId === order.id}
                              className="self-start rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200 hover:bg-red-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
                            >
                              {deletingOrderId === order.id ? '刪除中...' : '刪除訂單'}
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
                                <p className="text-white/80 font-mono text-xs mt-1">{order.id}</p>
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
