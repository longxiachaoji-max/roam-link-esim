"use client";

import { useCallback, useEffect, useState } from 'react';
import { Barcode, ExternalLink, FileCheck2, RefreshCw, Smartphone, Upload, WalletCards } from 'lucide-react';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { compressImageForUpload } from '@/lib/client-image-compression';

interface BarcodeOrderItem {
  id: string;
  price: number;
  products: { name: string; country: string; validity_days: number } | { name: string; country: string; validity_days: number }[] | null;
}

interface BarcodeOrder {
  id: string;
  order_number: string;
  created_at: string;
  total_amount: number;
  payment_method: 'ECPAY' | 'ECPAY_TOPUP';
  payment_status: string;
  order_status: string;
  ecpay_merchant_trade_no: string | null;
  payment_proof_uploaded_at: string | null;
  payment_proof_url: string | null;
  manual_payment_confirmed_at: string | null;
  ecpay_paid_at: string | null;
  order_items: BarcodeOrderItem[];
}

function getProduct(item: BarcodeOrderItem) {
  return Array.isArray(item.products) ? item.products[0] : item.products;
}

function getStatus(order: BarcodeOrder) {
  if (order.ecpay_paid_at) return { label: '已收到款項', className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' };
  if (order.manual_payment_confirmed_at || order.payment_status === 'PAID') return { label: '已人工確認', className: 'border-cyan/25 bg-cyan/10 text-cyan' };
  if (order.payment_proof_uploaded_at) return { label: '收據待審核', className: 'border-amber-300/25 bg-amber-300/10 text-amber-100' };
  return { label: '等待繳款', className: 'border-white/10 bg-white/5 text-white/55' };
}

export default function BarcodeOrdersPanel() {
  const [orders, setOrders] = useState<BarcodeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState('');
  const [message, setMessage] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await authenticatedFetch('/api/member/barcode-orders', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '超商付款訂單載入失敗');
      setOrders(result.orders || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '超商付款訂單載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

  const uploadReceipt = async (order: BarcodeOrder, sourceFile: File) => {
    if (uploadingId) return;
    setUploadingId(order.id);
    setMessage('');
    try {
      let uploadBlob: Blob = sourceFile;
      let fileName = sourceFile.name || 'receipt';
      if (sourceFile.type.startsWith('image/')) {
        const prepared = await compressImageForUpload(sourceFile, 'barcode-receipt');
        uploadBlob = prepared.blob;
        fileName = prepared.fileName;
      }

      const formData = new FormData();
      formData.set('orderId', order.id);
      formData.set('receipt', uploadBlob, fileName);
      const response = await authenticatedFetch('/api/member/barcode-orders', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '收據上傳失敗');
      await loadOrders();
      setMessage('收據已送出，後台確認後會立即入帳或配發 eSIM。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '收據上傳失敗');
    } finally {
      setUploadingId('');
    }
  };

  if (loading) return <div className="py-12 text-center text-sm text-white/40">正在載入超商付款訂單...</div>;

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">超商付款訂單</h2>
          <p className="mt-1 text-xs leading-5 text-white/45">繳款後可上傳收據供後台提早確認；綠界入帳後也會自動更新。</p>
        </div>
        <button type="button" onClick={() => void loadOrders()} title="重新整理" className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/10 text-white/55 hover:bg-white/5 hover:text-white">
          <RefreshCw size={17} />
        </button>
      </div>

      {message && <div className="mb-4 rounded-md border border-cyan/20 bg-cyan/10 px-3 py-2 text-sm leading-6 text-cyan-100">{message}</div>}

      <div className="space-y-3">
        {orders.map(order => {
          const status = getStatus(order);
          const isTopup = order.payment_method === 'ECPAY_TOPUP';
          const isPaid = order.payment_status === 'PAID';
          const productNames = order.order_items.map(item => getProduct(item)?.name).filter(Boolean);
          return (
            <article key={order.id} className="rounded-md border border-white/10 bg-[#1a1a24] p-4 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/5 text-white/70">
                    {isTopup ? <WalletCards size={19} /> : <Smartphone size={19} />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold">{isTopup ? '一飛通儲值金' : productNames.join('、') || 'eSIM 訂單'}</h3>
                    <p className="mt-1 text-xs text-white/40">#{order.order_number || order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleString('zh-TW')}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 border-y border-white/[0.07] py-3 text-sm">
                <div><p className="text-xs text-white/35">付款用途</p><p className="mt-1 font-bold">{isTopup ? '會員儲值' : '購買 eSIM'}</p></div>
                <div className="text-right"><p className="text-xs text-white/35">應付金額</p><p className="mt-1 text-lg font-black text-amber-200">NT$ {Number(order.total_amount).toLocaleString()}</p></div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/35">
                <span className="inline-flex items-center gap-1.5"><Barcode size={14} />綠界編號：{order.ecpay_merchant_trade_no || '-'}</span>
                {order.payment_proof_uploaded_at && <span>收據：{new Date(order.payment_proof_uploaded_at).toLocaleString('zh-TW')}</span>}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {order.payment_proof_url && (
                  <a href={order.payment_proof_url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 text-sm font-bold text-white/75 hover:bg-white/10">
                    <FileCheck2 size={16} />查看已上傳收據<ExternalLink size={14} />
                  </a>
                )}
                {!isPaid && (
                  <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#F05A28] px-3 text-sm font-bold text-white hover:bg-[#d94f22]">
                    <Upload size={16} />
                    {uploadingId === order.id ? '上傳中...' : order.payment_proof_uploaded_at ? '更換收據' : '上傳繳款收據'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      disabled={Boolean(uploadingId)}
                      className="sr-only"
                      onChange={event => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (file) void uploadReceipt(order, file);
                      }}
                    />
                  </label>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {orders.length === 0 && <div className="border border-white/10 bg-white/[0.03] py-12 text-center text-sm text-white/40">目前沒有超商付款訂單</div>}
    </div>
  );
}
