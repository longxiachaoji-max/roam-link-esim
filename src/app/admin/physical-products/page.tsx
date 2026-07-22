"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, ImageIcon, Pencil, Plus, Save, Settings2, Trash2, Upload, X } from 'lucide-react';
import { adminFetch } from '@/lib/admin-fetch';
import type { RentalPriceTier } from '@/lib/rental-pricing';
import { DEFAULT_PHYSICAL_STORE_SETTINGS, type PhysicalStoreSettings } from '@/lib/physical-store-settings';

type Category = 'rental' | 'travel_card' | 'other';

interface Product {
  id: string;
  name: string;
  category: Category;
  summary: string | null;
  description: string | null;
  rental_terms: string | null;
  rental_price_tiers: RentalPriceTier[];
  rental_free_shipping_days: number | null;
  price: number;
  stock_quantity: number;
  images: string[];
  is_active: boolean;
  sort_order: number;
}

const CATEGORY_LABELS: Record<Category, string> = {
  rental: '商品租借',
  travel_card: '實體漫遊卡',
  other: '其他旅遊商品'
};

const EMPTY_FORM = {
  name: '',
  category: 'travel_card' as Category,
  summary: '',
  description: '',
  rental_terms: '',
  rental_price_tiers: [] as RentalPriceTier[],
  rental_free_shipping_days: null as number | null,
  price: 0,
  stock_quantity: 0,
  images: [] as string[],
  is_active: false,
  sort_order: 0
};

const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_EDGE = 2000;
const TARGET_PRODUCT_IMAGE_BYTES = 1.5 * 1024 * 1024;
const PASSTHROUGH_IMAGE_BYTES = 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function loadBrowserImage(file: File) {
  return new Promise<{ image: HTMLImageElement; objectUrl: string }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('無法讀取圖片，請改用 JPG、PNG、WebP 或 AVIF'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('圖片壓縮失敗')), 'image/webp', quality);
  });
}

async function compressProductImage(file: File) {
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('原始圖片不可超過 25MB');

  const { image, objectUrl } = await loadBrowserImage(file);
  try {
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    if (file.size <= PASSTHROUGH_IMAGE_BYTES && longestEdge <= MAX_PRODUCT_IMAGE_EDGE) return file;

    const scale = Math.min(1, MAX_PRODUCT_IMAGE_EDGE / longestEdge);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('瀏覽器無法壓縮圖片');
    context.drawImage(image, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, 0.84);
    for (const quality of [0.76, 0.68]) {
      if (blob.size <= TARGET_PRODUCT_IMAGE_BYTES) break;
      blob = await canvasToBlob(canvas, quality);
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'product-image';
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function PhysicalProductsAdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUploadNote, setImageUploadNote] = useState('');
  const [message, setMessage] = useState('');
  const [storeSettings, setStoreSettings] = useState<PhysicalStoreSettings>(DEFAULT_PHYSICAL_STORE_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const [productsResponse, settingsResponse] = await Promise.all([
        adminFetch('/api/admin/physical-products', { cache: 'no-store' }),
        adminFetch('/api/admin/physical-store-settings', { cache: 'no-store' })
      ]);
      const [productsResult, settingsResult] = await Promise.all([productsResponse.json(), settingsResponse.json()]);
      if (!productsResponse.ok) throw new Error(productsResult.error || '讀取商品失敗');
      if (!settingsResponse.ok) throw new Error(settingsResult.error || '讀取商城設定失敗');
      setProducts(productsResult.products || []);
      setStoreSettings(settingsResult.settings || DEFAULT_PHYSICAL_STORE_SETTINGS);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '讀取商品失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProducts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageUploadNote('');
    setIsEditorOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setImageUploadNote('');
    setForm({
      name: product.name,
      category: product.category,
      summary: product.summary || '',
      description: product.description || '',
      rental_terms: product.rental_terms || '',
      rental_price_tiers: product.rental_price_tiers || [],
      rental_free_shipping_days: product.rental_free_shipping_days,
      price: product.price,
      stock_quantity: product.stock_quantity,
      images: product.images || [],
      is_active: product.is_active,
      sort_order: product.sort_order
    });
    setIsEditorOpen(true);
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setMessage('');
    setImageUploadNote('正在壓縮圖片...');
    try {
      const uploadFile = await compressProductImage(file);
      const body = new FormData();
      body.append('file', uploadFile);
      const response = await adminFetch('/api/admin/physical-products/upload', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '圖片上傳失敗');
      setForm(current => ({ ...current, images: [...current.images, result.url].slice(0, 8) }));
      setImageUploadNote(file.size === uploadFile.size
        ? `圖片已上傳（${formatFileSize(uploadFile.size)}）`
        : `已自動壓縮 ${formatFileSize(file.size)} → ${formatFileSize(uploadFile.size)}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '圖片上傳失敗';
      setMessage(errorMessage);
      setImageUploadNote(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const saveProduct = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await adminFetch('/api/admin/physical-products', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: editingId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '儲存商品失敗');
      setIsEditorOpen(false);
      setMessage(editingId ? '商品已更新' : '商品已新增');
      await loadProducts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '儲存商品失敗');
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`確定刪除「${product.name}」嗎？歷史訂單仍會保留商品名稱。`)) return;
    const response = await adminFetch(`/api/admin/physical-products?id=${product.id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error || '刪除失敗');
    setMessage('商品已刪除');
    await loadProducts();
  };

  const saveStoreSettings = async () => {
    setSavingSettings(true);
    setMessage('');
    try {
      const response = await adminFetch('/api/admin/physical-store-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(storeSettings)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '儲存商城設定失敗');
      setStoreSettings(result.settings);
      setMessage('配送與免運設定已儲存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '儲存商城設定失敗');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl pb-20">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">實體商品管理</h1>
          <p className="mt-1 text-sm text-white/45">管理商品租借、實體漫遊卡與商品詳細頁</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/shop" target="_blank" className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 px-4 text-sm text-white/75 hover:bg-white/5">
            <ExternalLink size={16} /> 查看商城
          </Link>
          <button onClick={openNew} className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-500 px-4 text-sm font-bold text-[#07141a] hover:bg-cyan-400">
            <Plus size={17} /> 新增商品
          </button>
        </div>
      </div>

      {message && <div className="mb-5 rounded-md border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">{message}</div>}

      <section className="mb-6 overflow-hidden rounded-md border border-white/10 bg-[#141426]">
        <button type="button" onClick={() => setSettingsOpen(value => !value)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.03]">
          <span className="flex items-center gap-3"><Settings2 size={18} className="text-cyan-300" /><span><span className="block font-semibold text-white">商城配送與免運</span><span className="mt-1 block text-xs text-white/40">宅配 NT${storeSettings.shipping_fee.toLocaleString()} · 滿 NT${storeSettings.free_shipping_threshold.toLocaleString()} 免運 · 租期免運改由各商品設定</span></span></span>
          <span className="text-xs text-white/45">{settingsOpen ? '收起' : '開啟設定'}</span>
        </button>
        {settingsOpen && <div className="border-t border-white/10 px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-white/65">宅配運費 (NT$)<input type="number" min="0" value={storeSettings.shipping_fee} onChange={e => setStoreSettings({ ...storeSettings, shipping_fee: Number(e.target.value) })} className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /></label>
            <label className="text-sm text-white/65">滿額免運門檻 (NT$)<input type="number" min="0" value={storeSettings.free_shipping_threshold} onChange={e => setStoreSettings({ ...storeSettings, free_shipping_threshold: Number(e.target.value) })} className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /></label>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/70">
            <label className="flex items-center gap-2"><input type="checkbox" checked={storeSettings.free_shipping_enabled} onChange={e => setStoreSettings({ ...storeSettings, free_shipping_enabled: e.target.checked })} className="h-4 w-4 accent-cyan-400" />啟用滿額免運</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={storeSettings.pickup_enabled} onChange={e => setStoreSettings({ ...storeSettings, pickup_enabled: e.target.checked })} className="h-4 w-4 accent-cyan-400" />開放預約面交</label>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-white/65">面交名稱或地點<input value={storeSettings.pickup_label} onChange={e => setStoreSettings({ ...storeSettings, pickup_label: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 text-white outline-none focus:border-cyan-400" /></label>
            <label className="text-sm text-white/65">面交說明<input value={storeSettings.pickup_instructions} onChange={e => setStoreSettings({ ...storeSettings, pickup_instructions: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 text-white outline-none focus:border-cyan-400" /></label>
          </div>
          <div className="mt-5 flex justify-end"><button type="button" onClick={saveStoreSettings} disabled={savingSettings} className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-500 px-4 text-sm font-bold text-[#07141a] disabled:opacity-40"><Save size={16} />{savingSettings ? '儲存中...' : '儲存配送設定'}</button></div>
        </div>}
      </section>

      <div className="overflow-hidden rounded-md border border-white/10 bg-[#141426]">
        <div className="grid grid-cols-[72px_minmax(220px,1fr)_140px_110px_90px_110px] gap-4 border-b border-white/10 px-5 py-3 text-xs font-medium text-white/40 max-lg:hidden">
          <span>圖片</span><span>商品</span><span>分類</span><span>售價</span><span>庫存</span><span className="text-right">操作</span>
        </div>
        {loading ? (
          <div className="px-5 py-16 text-center text-white/40">載入商品中...</div>
        ) : products.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <ImageIcon className="mx-auto mb-3 text-white/20" size={36} />
            <p className="text-white/55">尚未新增實體商品</p>
          </div>
        ) : products.map(product => (
          <div key={product.id} className="grid grid-cols-1 gap-4 border-b border-white/8 px-5 py-4 last:border-b-0 lg:grid-cols-[72px_minmax(220px,1fr)_140px_110px_90px_110px] lg:items-center">
            <div className="relative h-16 w-16 overflow-hidden rounded-md bg-white/5">
              {product.images[0] ? <Image src={product.images[0]} alt="" fill sizes="64px" className="object-cover" /> : <ImageIcon className="m-5 text-white/20" size={24} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-white">{product.name}</p>
                <span className={`rounded px-2 py-0.5 text-[11px] ${product.is_active ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/8 text-white/40'}`}>{product.is_active ? '已上架' : '未上架'}</span>
              </div>
              <p className="mt-1 truncate text-sm text-white/40">{product.summary || '尚未填寫商品摘要'}</p>
            </div>
            <span className="text-sm text-white/65">{CATEGORY_LABELS[product.category]}</span>
            <span className="font-mono text-sm font-semibold text-amber-300">NT${product.price.toLocaleString()}</span>
            <span className={`font-mono text-sm ${product.stock_quantity > 0 ? 'text-white/70' : 'text-rose-300'}`}>{product.stock_quantity}</span>
            <div className="flex justify-end gap-2">
              <button title="編輯商品" onClick={() => openEdit(product)} className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/65 hover:bg-white/8 hover:text-white"><Pencil size={16} /></button>
              <button title="刪除商品" onClick={() => deleteProduct(product)} className="grid h-9 w-9 place-items-center rounded-md border border-rose-400/20 text-rose-300 hover:bg-rose-400/10"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onMouseDown={event => event.target === event.currentTarget && setIsEditorOpen(false)}>
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#121223] p-5 shadow-2xl md:p-8">
            <div className="mb-7 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{editingId ? '編輯實體商品' : '新增實體商品'}</h2>
              <button title="關閉" onClick={() => setIsEditorOpen(false)} className="grid h-9 w-9 place-items-center rounded-md text-white/55 hover:bg-white/8 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-5">
              <label className="block text-sm text-white/65">商品名稱
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 text-white outline-none focus:border-cyan-400" placeholder="例如：日本實體漫遊卡 7天" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-white/65">分類
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as Category })} className="mt-2 h-11 w-full rounded-md border border-white/12 bg-[#0d0d1a] px-3 text-white outline-none focus:border-cyan-400">
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="block text-sm text-white/65">排序
                  <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" />
                </label>
              </div>
              <label className="block text-sm text-white/65">列表摘要
                <input value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 text-white outline-none focus:border-cyan-400" placeholder="列表上快速說明商品特色" />
              </label>
              <label className="block text-sm text-white/65">商品詳細內容
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={7} className="mt-2 w-full rounded-md border border-white/12 bg-black/25 p-3 text-white outline-none focus:border-cyan-400" placeholder="規格、適用地區、使用方法、注意事項..." />
              </label>
              {form.category === 'rental' && <>
                <label className="block text-sm text-white/65">租借說明
                  <textarea value={form.rental_terms} onChange={e => setForm({ ...form, rental_terms: e.target.value })} rows={4} className="mt-2 w-full rounded-md border border-white/12 bg-black/25 p-3 text-white outline-none focus:border-cyan-400" placeholder="押金、交付、歸還方式與逾期規則" />
                </label>
                <div className="rounded-md border border-white/10 bg-black/15 p-4">
                  <label className="flex items-center gap-3 text-sm font-semibold text-white/75"><input type="checkbox" checked={form.rental_free_shipping_days !== null} onChange={e => setForm({ ...form, rental_free_shipping_days: e.target.checked ? 3 : null })} className="h-4 w-4 accent-cyan-400" />此商品啟用租期免運</label>
                  {form.rental_free_shipping_days !== null && <label className="mt-4 block max-w-xs text-xs text-white/45">租借滿幾天免運<input type="number" min="1" max="365" value={form.rental_free_shipping_days} onChange={e => setForm({ ...form, rental_free_shipping_days: Math.max(1, Number(e.target.value)) })} className="mt-1 h-10 w-full rounded-md border border-white/12 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /></label>}
                  <p className="mt-2 text-xs text-white/30">未啟用時仍可套用商城滿額免運或預約面交。</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/15 p-4">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white/75">階梯式租借售價</p><p className="mt-1 text-xs text-white/35">每個級距會沿用到下一級；可設定折扣率或該天數的固定總價。</p></div><button type="button" onClick={() => setForm(current => ({ ...current, rental_price_tiers: [...current.rental_price_tiers, { days: Math.max(2, (current.rental_price_tiers.at(-1)?.days || 1) + 1), mode: 'discount', discount: 10 }] }))} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-cyan-400/25 text-cyan-300 hover:bg-cyan-400/10" title="新增租期級距"><Plus size={16} /></button></div>
                  <div className="mt-4 space-y-3">{form.rental_price_tiers.length === 0 ? <p className="py-3 text-center text-xs text-white/30">尚未設定租期優惠</p> : form.rental_price_tiers.map((tier, index) => <div key={`${tier.days}-${index}`} className="grid grid-cols-[0.8fr_1fr_1.15fr_36px] items-end gap-2"><label className="text-xs text-white/45">起始天數<input type="number" min="2" max="365" value={tier.days} onChange={e => setForm(current => ({ ...current, rental_price_tiers: current.rental_price_tiers.map((item, itemIndex) => itemIndex === index ? { ...item, days: Number(e.target.value) } : item) }))} className="mt-1 h-10 w-full rounded-md border border-white/12 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /></label><label className="text-xs text-white/45">計價方式<select value={tier.mode} onChange={e => setForm(current => ({ ...current, rental_price_tiers: current.rental_price_tiers.map((item, itemIndex) => itemIndex === index ? e.target.value === 'discount' ? { days: item.days, mode: 'discount', discount: 10 } : { days: item.days, mode: 'fixed_total', total: Math.round(current.price * item.days) } : item) }))} className="mt-1 h-10 w-full rounded-md border border-white/12 bg-[#0d0d1a] px-2 text-white outline-none focus:border-cyan-400"><option value="discount">折扣率</option><option value="fixed_total">固定總價</option></select></label><label className="text-xs text-white/45">{tier.mode === 'discount' ? '折扣（減少 %）' : '該天數總價 (NT$)'}<input type="number" min="0" max={tier.mode === 'discount' ? 100 : undefined} value={tier.mode === 'discount' ? tier.discount || 0 : tier.total || 0} onChange={e => setForm(current => ({ ...current, rental_price_tiers: current.rental_price_tiers.map((item, itemIndex) => itemIndex === index ? item.mode === 'discount' ? { ...item, discount: Number(e.target.value) } : { ...item, total: Number(e.target.value) } : item) }))} className="mt-1 h-10 w-full rounded-md border border-white/12 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /></label><button type="button" title="刪除租期級距" onClick={() => setForm(current => ({ ...current, rental_price_tiers: current.rental_price_tiers.filter((_, itemIndex) => itemIndex !== index) }))} className="grid h-10 w-9 place-items-center rounded-md text-rose-300 hover:bg-rose-400/10"><Trash2 size={15} /></button></div>)}</div>
                </div>
              </>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-white/65">{form.category === 'rental' ? '每日租金 (NT$)' : '售價 (NT$)'}
                  <input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" />
                </label>
                <label className="block text-sm text-white/65">庫存
                  <input type="number" min="0" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: Number(e.target.value) })} className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" />
                </label>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-white/65">商品圖片（第一張為封面，最多 8 張）</span>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/5">
                    <Upload size={15} /> {uploading ? '壓縮並上傳中...' : '上傳圖片'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading || form.images.length >= 8} className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) uploadImage(file); e.target.value = ''; }} />
                  </label>
                </div>
                {imageUploadNote && <p className="mb-3 text-xs text-cyan-300/80">{imageUploadNote}</p>}
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {form.images.map((url, index) => (
                    <div key={url} className="relative aspect-square overflow-hidden rounded-md border border-white/10 bg-white/5">
                      <Image src={url} alt="" fill sizes="160px" className="object-cover" />
                      {index === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px]">封面</span>}
                      <button title="移除圖片" onClick={() => setForm(current => ({ ...current, images: current.images.filter(item => item !== url) }))} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded bg-black/75 text-white"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 border-t border-white/10 pt-5 text-sm text-white/75">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-cyan-400" />
                儲存後立即在實體商城上架
              </label>
            </div>

            <div className="sticky bottom-0 mt-8 flex justify-end gap-3 border-t border-white/10 bg-[#121223] py-5">
              <button onClick={() => setIsEditorOpen(false)} className="h-11 rounded-md border border-white/15 px-5 text-sm text-white/65 hover:bg-white/5">取消</button>
              <button onClick={saveProduct} disabled={saving || uploading} className="h-11 rounded-md bg-cyan-500 px-6 text-sm font-bold text-[#07141a] hover:bg-cyan-400 disabled:opacity-40">{saving ? '儲存中...' : '儲存商品'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
