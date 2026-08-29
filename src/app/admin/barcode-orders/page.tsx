"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Barcode, CheckCircle2, ExternalLink, FileWarning, RefreshCw, Search, Smartphone, Upload, WalletCards, X } from 'lucide-react';
import { adminFetch } from '@/lib/admin-fetch';
import { compressImageForUpload } from '@/lib/client-image-compression';
import { analyzeReceiptText, getBarcodeAmount } from '@/lib/barcode-receipt-matching';

interface ProductInfo {
  name: string;
  country: string;
  validity_days: number;
}

interface BarcodeOrderItem {
  id: string;
  price: number;
  inventory_id: string | null;
  products: ProductInfo | ProductInfo[] | null;
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
  ecpay_trade_no: string | null;
  ecpay_barcode_1: string | null;
  ecpay_barcode_2: string | null;
  ecpay_barcode_3: string | null;
  payment_proof_uploaded_at: string | null;
  payment_proof_url: string | null;
  payment_proof_is_pdf: boolean;
  manual_payment_confirmed_at: string | null;
  ecpay_paid_at: string | null;
  ecpay_barcode_expires_at: string | null;
  customers: { email: string; name: string | null } | { email: string; name: string | null }[] | null;
  order_items: BarcodeOrderItem[];
}

function relation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] || null : value;
}

function statusInfo(order: BarcodeOrder) {
  if (order.ecpay_paid_at) return { label: '已收到款項', className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' };
  if (order.manual_payment_confirmed_at || order.payment_status === 'PAID') return { label: '已人工放行', className: 'border-cyan/25 bg-cyan/10 text-cyan' };
  if (order.payment_proof_uploaded_at) return { label: '收據待審核', className: 'border-amber-300/30 bg-amber-300/10 text-amber-100' };
  if (order.payment_status === 'EXPIRED') return { label: '已逾期取消', className: 'border-red-300/25 bg-red-300/10 text-red-200' };
  return { label: '等待繳款', className: 'border-white/10 bg-white/5 text-white/55' };
}

interface ReceiptScanResult {
  barcode2Matched: boolean;
  amountMatched: boolean;
  confidence: number;
  normalizedText: string;
}

export default function AdminBarcodeOrdersPage() {
  const [orders, setOrders] = useState<BarcodeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'pending' | 'paid' | 'all'>('pending');
  const [confirmOrder, setConfirmOrder] = useState<BarcodeOrder | null>(null);
  const [reviewOrder, setReviewOrder] = useState<BarcodeOrder | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [uploadingId, setUploadingId] = useState('');
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [scanError, setScanError] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch('/api/admin/barcode-orders', { cache: 'no-store' });
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

  const filteredOrders = useMemo(() => orders.filter(order => {
    if (filter === 'pending' && order.payment_status !== 'PENDING') return false;
    if (filter === 'paid' && order.payment_status !== 'PAID') return false;
    const customer = relation(order.customers);
    const productNames = order.order_items.map(item => relation(item.products)?.name || '').join(' ');
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return [order.order_number, order.ecpay_merchant_trade_no, order.ecpay_trade_no, customer?.email, customer?.name, productNames]
      .some(value => String(value || '').toLowerCase().includes(normalizedQuery));
  }), [filter, orders, query]);

  const approveOrder = async () => {
    if (!confirmOrder || confirming) return;
    setConfirming(true);
    setMessage('');
    try {
      const response = await adminFetch('/api/admin/barcode-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: confirmOrder.id })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '確認付款失敗');
      setConfirmOrder(null);
      await loadOrders();
      setMessage(result.message || '付款已確認');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '確認付款失敗');
    } finally {
      setConfirming(false);
    }
  };

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
      const response = await adminFetch('/api/admin/barcode-orders', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '收據上傳失敗');
      await loadOrders();
      setMessage(result.message || '收據已上傳');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '收據上傳失敗');
    } finally {
      setUploadingId('');
    }
  };

  const openReceiptReview = (order: BarcodeOrder) => {
    setScanResult(null);
    setScanError('');
    setScanProgress(0);
    setReviewOrder(order);
  };

  const scanReceipt = async () => {
    if (!reviewOrder?.payment_proof_url || reviewOrder.payment_proof_is_pdf || scanningReceipt) return;
    setScanningReceipt(true);
    setScanResult(null);
    setScanError('');
    setScanProgress(0);
    let worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>> | null = null;
    try {
      const [{ createWorker }, imageResponse] = await Promise.all([
        import('tesseract.js'),
        fetch(reviewOrder.payment_proof_url, { cache: 'no-store' })
      ]);
      if (!imageResponse.ok) throw new Error('收據圖片已過期，請關閉視窗後重新開啟');
      const image = await imageResponse.blob();
      worker = await createWorker('eng', undefined, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/tesseract-core-lstm.wasm.js',
        langPath: '/ocr',
        logger: message => {
          if (message.status === 'recognizing text') setScanProgress(Math.round(message.progress * 100));
        }
      });
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$NTD,.- ',
        preserve_interword_spaces: '1'
      });
      const result = await worker.recognize(image, { rotateAuto: true });
      const comparison = analyzeReceiptText(result.data.text, {
        barcode2: reviewOrder.ecpay_barcode_2,
        amount: reviewOrder.total_amount
      });
      setScanResult({ ...comparison, confidence: Math.round(result.data.confidence) });
    } catch (error) {
      setScanError(error instanceof Error ? error.message : '收據辨識失敗，請改用人工核對');
    } finally {
      if (worker) await worker.terminate().catch(() => undefined);
      setScanningReceipt(false);
    }
  };

  const pendingCount = orders.filter(order => order.payment_status === 'PENDING').length;
  const receiptCount = orders.filter(order => order.payment_status === 'PENDING' && order.payment_proof_uploaded_at).length;

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">超商付款訂單</h1>
          <p className="mt-1 text-sm text-white/45">待付款 {pendingCount} 筆，其中 {receiptCount} 筆已上傳收據</p>
        </div>
        <button type="button" onClick={() => void loadOrders()} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 text-sm font-bold text-white/70 hover:bg-white/10">
          <RefreshCw size={16} />重新整理
        </button>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="flex h-11 min-w-0 flex-1 items-center border border-white/10 bg-white/5 px-3">
          <Search size={17} className="mr-2 shrink-0 text-white/35" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜尋會員、訂單、綠界編號或商品" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
        </div>
        <div className="grid h-11 grid-cols-3 border border-white/10 bg-white/5 p-1 text-sm">
          {([['pending', '待處理'], ['paid', '已確認'], ['all', '全部']] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`min-w-20 px-3 font-bold ${filter === value ? 'bg-cyan text-[#0B0B1A]' : 'text-white/55 hover:text-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      {message && <div className="mb-4 rounded-md border border-cyan/20 bg-cyan/10 px-3 py-2 text-sm leading-6 text-cyan-100">{message}</div>}

      {loading ? <div className="py-16 text-center text-sm text-white/40">正在載入超商付款訂單...</div> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredOrders.map(order => {
            const status = statusInfo(order);
            const customer = relation(order.customers);
            const isTopup = order.payment_method === 'ECPAY_TOPUP';
            const productNames = order.order_items.map(item => relation(item.products)?.name).filter(Boolean);
            const fulfilledCount = order.order_items.filter(item => item.inventory_id).length;
            const barcodeAmount = getBarcodeAmount(order.ecpay_barcode_3);
            return (
              <article key={order.id} className="rounded-md border border-white/10 bg-[#151525] p-4 shadow-lg sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/5 text-white/70">{isTopup ? <WalletCards size={19} /> : <Smartphone size={19} />}</div>
                    <div className="min-w-0"><h2 className="truncate font-bold">{customer?.name || customer?.email || '未知會員'}</h2><p className="mt-1 truncate text-xs text-white/40">{customer?.email || '-'}</p></div>
                  </div>
                  <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-y border-white/[0.07] py-4">
                  <div><p className="text-xs text-white/35">付款用途</p><p className="mt-1 font-bold">{isTopup ? '會員儲值' : '購買 eSIM'}</p></div>
                  <div className="text-right"><p className="text-xs text-white/35">付款金額</p><p className="mt-1 text-xl font-black text-amber-200">NT$ {Number(order.total_amount).toLocaleString()}</p></div>
                  <div><p className="text-xs text-white/35">訂單編號</p><p className="mt-1 font-mono text-sm text-white/75">{order.order_number}</p></div>
                  <div className="text-right"><p className="text-xs text-white/35">建立時間</p><p className="mt-1 text-sm text-white/75">{new Date(order.created_at).toLocaleString('zh-TW')}</p></div>
                </div>

                {!isTopup && <div className="mt-3 rounded-md bg-black/20 px-3 py-2 text-sm leading-6 text-white/65"><p>{productNames.join('、') || '商品資料讀取中'}</p>{order.payment_status === 'PAID' && <p className="mt-1 text-xs text-white/35">已配發 {fulfilledCount}／{order.order_items.length} 張</p>}</div>}

                <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-white/40"><Barcode size={14} className="mt-0.5 shrink-0" /><span><span className="block break-all">特店交易編號：{order.ecpay_merchant_trade_no || '-'}</span><span className="mt-0.5 block break-all">綠界交易編號：{order.ecpay_trade_no || '-'}</span></span></div>

                <div className="mt-3 space-y-1.5 rounded-md border border-white/[0.07] bg-black/15 p-3 text-xs">
                  <p className="mb-2 font-bold text-white/55">三段條碼編號</p>
                  {[order.ecpay_barcode_1, order.ecpay_barcode_2, order.ecpay_barcode_3].map((value, index) => <div key={index} className={`flex min-w-0 items-start gap-2 ${index === 1 ? 'text-cyan' : 'text-white/55'}`}><span className="shrink-0">第 {index + 1} 段{index === 1 ? '（收據主要比對）' : ''}</span><span className="min-w-0 break-all font-mono">{value || '舊訂單未保存'}</span></div>)}
                  {barcodeAmount !== null && <p className={`pt-1 ${barcodeAmount === Math.round(Number(order.total_amount)) ? 'text-emerald-300' : 'text-red-200'}`}>第三段條碼內金額：NT$ {barcodeAmount.toLocaleString()} {barcodeAmount === Math.round(Number(order.total_amount)) ? '（與訂單相符）' : '（與訂單不符，請勿放行）'}</p>}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {order.payment_proof_url ? (
                    <button type="button" onClick={() => openReceiptReview(order)} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 text-sm font-bold text-white/75 hover:bg-white/10">核對繳款收據<ExternalLink size={15} /></button>
                  ) : (
                    <div className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-amber-300/15 bg-amber-300/5 text-sm font-bold text-amber-100/60"><FileWarning size={16} />尚未上傳收據</div>
                  )}
                  {order.payment_status !== 'PAID' && <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-cyan/20 bg-cyan/8 px-3 text-sm font-bold text-cyan-100 hover:bg-cyan/15"><Upload size={16} />{uploadingId === order.id ? '上傳中...' : order.payment_proof_url ? '更換收據' : '代為上傳收據'}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={Boolean(uploadingId)} className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadReceipt(order, file); }} /></label>}
                  {order.payment_status === 'PENDING' && <button type="button" onClick={() => setConfirmOrder(order)} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-500"><CheckCircle2 size={16} />確認已繳款並放行</button>}
                </div>

                {(order.manual_payment_confirmed_at || order.ecpay_paid_at) && <div className="mt-3 text-xs leading-5 text-white/35">{order.ecpay_paid_at ? `綠界入帳：${new Date(order.ecpay_paid_at).toLocaleString('zh-TW')}` : `人工確認：${new Date(order.manual_payment_confirmed_at!).toLocaleString('zh-TW')}`}</div>}
              </article>
            );
          })}
        </div>
      )}

      {!loading && filteredOrders.length === 0 && <div className="border border-white/10 bg-white/[0.03] py-16 text-center text-sm text-white/40">目前沒有符合條件的超商付款訂單</div>}

      {reviewOrder?.payment_proof_url && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-6xl rounded-md border border-white/10 bg-[#141421] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6">
              <div><p className="text-xs font-bold text-cyan">人工核對付款</p><h2 className="mt-1 text-xl font-bold">收據與訂單資料</h2></div>
              <button type="button" onClick={() => setReviewOrder(null)} title="關閉" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-white/45 hover:bg-white/5 hover:text-white"><X size={19} /></button>
            </div>
            <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
              <div className="min-h-[360px] bg-black/35 p-3 sm:p-5">
                {reviewOrder.payment_proof_is_pdf ? (
                  <iframe src={reviewOrder.payment_proof_url} title="繳款收據" className="h-[68vh] min-h-[420px] w-full border-0 bg-white" />
                ) : (
                  <div className="relative h-[68vh] min-h-[420px] w-full"><Image src={reviewOrder.payment_proof_url} alt="客戶上傳的繳款收據" fill unoptimized sizes="(min-width: 1024px) 65vw, 100vw" className="object-contain" /></div>
                )}
              </div>
              <div className="border-t border-white/10 p-4 sm:p-6 lg:border-l lg:border-t-0">
                <h3 className="font-bold">系統訂單資料</h3>
                <div className="mt-4 grid grid-cols-2 gap-3 border-y border-white/10 py-4 text-sm">
                  <div><p className="text-xs text-white/35">應收金額</p><p className="mt-1 text-xl font-black text-amber-200">NT$ {Number(reviewOrder.total_amount).toLocaleString()}</p></div>
                  <div className="text-right"><p className="text-xs text-white/35">上傳時間</p><p className="mt-1 text-white/70">{reviewOrder.payment_proof_uploaded_at ? new Date(reviewOrder.payment_proof_uploaded_at).toLocaleString('zh-TW') : '-'}</p></div>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div><dt className="text-xs text-white/35">訂單編號</dt><dd className="mt-1 break-all font-mono text-white/75">{reviewOrder.order_number}</dd></div>
                  <div><dt className="text-xs text-white/35">綠界特店交易編號</dt><dd className="mt-1 break-all font-mono text-white/75">{reviewOrder.ecpay_merchant_trade_no || '-'}</dd></div>
                  <div><dt className="text-xs text-white/35">綠界交易編號</dt><dd className="mt-1 break-all font-mono text-white/75">{reviewOrder.ecpay_trade_no || '-'}</dd></div>
                  <div><dt className="text-xs text-white/35">原始三段條碼號碼</dt><dd className="mt-2 space-y-1.5">{[reviewOrder.ecpay_barcode_1, reviewOrder.ecpay_barcode_2, reviewOrder.ecpay_barcode_3].map((value, index) => <div key={index} className="flex min-h-9 items-center gap-2 rounded-md bg-white/5 px-3"><span className="shrink-0 text-xs text-white/30">{index + 1}</span><span className="break-all font-mono text-white/80">{value || '舊訂單未保存'}</span></div>)}</dd></div>
                  <div><dt className="text-xs text-white/35">條碼期限</dt><dd className="mt-1 text-white/70">{reviewOrder.ecpay_barcode_expires_at ? new Date(reviewOrder.ecpay_barcode_expires_at).toLocaleString('zh-TW') : '-'}</dd></div>
                </dl>
                <div className="mt-5 border-t border-white/10 pt-5">
                  <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">照片自動比對</h3><p className="mt-1 text-xs text-white/35">辨識第二段條碼與實收金額，不會自動放行</p></div><button type="button" onClick={() => void scanReceipt()} disabled={reviewOrder.payment_proof_is_pdf || scanningReceipt} className="h-10 shrink-0 rounded-md bg-cyan px-3 text-sm font-bold text-[#0B0B1A] disabled:cursor-not-allowed disabled:opacity-40">{scanningReceipt ? `辨識中 ${scanProgress}%` : reviewOrder.payment_proof_is_pdf ? 'PDF 不支援' : '自動辨識收據'}</button></div>
                  {scanError && <div className="mt-3 rounded-md border border-red-300/20 bg-red-300/8 px-3 py-2 text-xs leading-5 text-red-100">{scanError}</div>}
                  {scanResult && <div className="mt-3 space-y-2 rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs"><div className="flex items-center justify-between gap-3"><span className="text-white/45">第二段條碼</span><span className={scanResult.barcode2Matched ? 'font-bold text-emerald-300' : 'text-amber-100'}>{scanResult.barcode2Matched ? '辨識相符' : '未辨識到，請人工查看'}</span></div><div className="flex items-center justify-between gap-3"><span className="text-white/45">收據金額</span><span className={scanResult.amountMatched ? 'font-bold text-emerald-300' : 'text-amber-100'}>{scanResult.amountMatched ? '辨識相符' : '未辨識到，請人工查看'}</span></div><div className="flex items-center justify-between gap-3"><span className="text-white/45">照片辨識信心</span><span className="text-white/65">{scanResult.confidence}%</span></div>{scanResult.barcode2Matched && scanResult.amountMatched ? <p className="border-t border-white/10 pt-2 font-bold text-emerald-300">條碼與金額皆辨識相符，仍請目視確認收據日期。</p> : <p className="border-t border-white/10 pt-2 leading-5 text-amber-100">自動辨識不完整不代表資料錯誤，請依上方原圖人工核對。</p>}<details className="border-t border-white/10 pt-2 text-white/35"><summary className="cursor-pointer">查看辨識文字</summary><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-5">{scanResult.normalizedText || '沒有辨識到文字'}</pre></details></div>}
                </div>
                <div className="mt-5 rounded-md border border-amber-300/20 bg-amber-300/8 px-3 py-3 text-xs leading-5 text-amber-100">請確認收據金額、繳款日期，以及收據上的條碼或交易資料與本區一致。收據照片不等於綠界已入帳；資料有疑問時請勿人工放行。</div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <a href={reviewOrder.payment_proof_url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 text-sm font-bold text-white/70 hover:bg-white/10">新視窗查看<ExternalLink size={15} /></a>
                  {reviewOrder.payment_status === 'PENDING' && <button type="button" onClick={() => { setConfirmOrder(reviewOrder); setReviewOrder(null); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-500"><CheckCircle2 size={16} />資料相符，前往放行</button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmOrder && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-md border border-white/10 bg-[#1A1A2E] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-emerald-300">人工確認付款</p><h2 className="mt-1 text-xl font-bold">確定放行這筆訂單？</h2></div><button type="button" onClick={() => setConfirmOrder(null)} title="關閉" className="grid h-9 w-9 place-items-center rounded-md text-white/45 hover:bg-white/5 hover:text-white"><X size={19} /></button></div>
            <div className="mt-5 rounded-md bg-black/25 p-4 text-sm leading-6 text-white/70"><p>訂單：{confirmOrder.order_number}</p><p>用途：{confirmOrder.payment_method === 'ECPAY_TOPUP' ? '會員儲值' : '購買 eSIM'}</p><p className="mt-1 text-lg font-black text-amber-200">NT$ {Number(confirmOrder.total_amount).toLocaleString()}</p></div>
            <div className={`mt-4 rounded-md border px-3 py-3 text-sm leading-6 ${confirmOrder.payment_proof_url ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-100' : 'border-amber-300/25 bg-amber-300/10 text-amber-100'}`}>{confirmOrder.payment_proof_url ? '請確認收據金額、繳款日期與條碼或交易資料皆相符。' : '此訂單尚未上傳收據。請確定已用其他方式核對款項後再放行。'}</div>
            <p className="mt-4 text-xs leading-5 text-white/40">確認後，儲值單會立即加入會員餘額；eSIM 訂單會立即開始配發。這個動作不能直接復原。</p>
            <div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setConfirmOrder(null)} disabled={confirming} className="h-11 rounded-md border border-white/15 text-sm font-bold text-white/60 hover:bg-white/5">取消</button><button type="button" onClick={() => void approveOrder()} disabled={confirming} className="h-11 rounded-md bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-45">{confirming ? '處理中...' : '確認款項並放行'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
