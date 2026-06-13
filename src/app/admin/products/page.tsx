'use client';

import { useState, useEffect } from 'react';
import { ClipboardList, Plus, Replace, Sparkles, X } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  country: string;
  description: string | null;
  data_amount: string | null;
  validity_days: number;
  price: number;
  is_active: boolean;
  created_at: string;
  stock: { available: number; total: number };
}

const COMMON_COUNTRIES = [
  '日本', '韓國', '泰國', '越南', '新加坡', '馬來西亞', '中國', '香港',
  '美國', '加拿大',
  '法國', '英國', '德國', '義大利',
  '澳洲', '紐西蘭'
];

type QuickDraft = {
  name: string;
  country: string;
  data_amount: string;
  validity_days: string;
  price: string;
  description: string;
};

type ReplaceField = 'name' | 'data_amount' | 'description' | 'all';

type QuickResult = {
  error?: string;
  inserted?: number;
  skipped?: number;
};

type ReplaceResult = {
  error?: string;
  updated?: number;
};

const QUICK_DEFAULTS = {
  country: '日本',
  baseName: '日本 KDDI 不限速吃到飽',
  days: '3,5,7,10,15',
  prices: '399,599,799,1299,1799',
  hotspotMode: 'total',
  hotspotGb: '4',
  suffix: '原生網路',
  dataPrefix: '不限速上網吃到飽',
  description: ''
};

const REPLACE_DEFAULTS = {
  country: '全部',
  field: 'all' as ReplaceField,
  findText: '每日熱點2GB',
  replaceText: '熱點總量4GB'
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchPreview, setBatchPreview] = useState<any[]>([]);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [quickForm, setQuickForm] = useState(QUICK_DEFAULTS);
  const [quickResult, setQuickResult] = useState<QuickResult | null>(null);
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [replaceForm, setReplaceForm] = useState(REPLACE_DEFAULTS);
  const [replaceResult, setReplaceResult] = useState<ReplaceResult | null>(null);
  const [isReplaceSubmitting, setIsReplaceSubmitting] = useState(false);

  const splitList = (value: string) => value
    .split(/[,，\n]/)
    .map(item => item.trim())
    .filter(Boolean);

  const hotspotText = quickForm.hotspotMode === 'daily'
    ? `每日熱點${quickForm.hotspotGb || 0}GB`
    : quickForm.hotspotMode === 'total'
      ? `熱點總量${quickForm.hotspotGb || 0}GB`
      : quickForm.hotspotGb.trim();

  const quickPreview: QuickDraft[] = splitList(quickForm.days).map((days, index) => {
    const prices = splitList(quickForm.prices);
    const suffix = quickForm.suffix ? quickForm.suffix.trim() : '';
    const hotspot = hotspotText.trim();
    return {
      name: `${quickForm.baseName.trim()}${days}天(${hotspot})${suffix}`.trim(),
      country: quickForm.country,
      data_amount: `${quickForm.dataPrefix.trim()}(${hotspot})`.trim(),
      validity_days: days,
      price: prices[index] || '',
      description: quickForm.description.trim()
    };
  }).filter(item => item.name && item.country && item.validity_days);

  const replaceInText = (value: string | null, findText: string, replaceText: string) => {
    if (!value || !findText) return value || '';
    return value.split(findText).join(replaceText);
  };

  const replaceFields: Exclude<ReplaceField, 'all'>[] = replaceForm.field === 'all'
    ? ['name', 'data_amount', 'description']
    : [replaceForm.field];

  const replacePreview = products
    .filter(product => replaceForm.country === '全部' || product.country === replaceForm.country)
    .map(product => {
      const updates: Partial<Pick<Product, 'name' | 'data_amount' | 'description'>> = {};
      let changed = false;

      for (const field of replaceFields) {
        const nextValue = replaceInText(product[field], replaceForm.findText, replaceForm.replaceText);
        if (nextValue !== (product[field] || '')) {
          updates[field] = nextValue;
          changed = true;
        }
      }

      return changed ? { product, updates } : null;
    })
    .filter(Boolean) as { product: Product; updates: Partial<Pick<Product, 'name' | 'data_amount' | 'description'>> }[];

  const parseBatchText = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];
    // 跳過標題行 (包含「商品名稱」或「國家」)
    const startIdx = lines[0].includes('商品名稱') || lines[0].includes('國家') ? 1 : 0;
    return lines.slice(startIdx).map(line => {
      const cols = line.split('\t');
      return {
        name: cols[0]?.trim() || '',
        country: cols[1]?.trim() || '',
        data_amount: cols[2]?.trim() || '',
        validity_days: cols[3]?.trim() || '',
        price: cols[4]?.trim() || '',
      };
    }).filter(r => r.name && r.country);
  };

  const handleBatchSubmit = async () => {
    if (isBatchSubmitting || batchPreview.length === 0) return;
    setIsBatchSubmitting(true);
    setBatchResult(null);
    try {
      const res = await fetch('/api/admin/products/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batchPreview })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '匯入失敗');
      setBatchResult(json);
      fetchProducts();
    } catch (err: any) {
      setBatchResult({ error: err.message });
    } finally {
      setIsBatchSubmitting(false);
    }
  };

  const handleQuickSubmit = async () => {
    if (isQuickSubmitting || quickPreview.length === 0) return;
    const invalid = quickPreview.filter(item => !item.price || Number.isNaN(Number(item.price)));
    if (invalid.length > 0) {
      setQuickResult({ error: '有商品缺少價格，請補齊每個天數對應的價格' });
      return;
    }

    setIsQuickSubmitting(true);
    setQuickResult(null);
    try {
      const res = await fetch('/api/admin/products/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: quickPreview })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '新增失敗');
      setQuickResult(json);
      fetchProducts();
    } catch (err) {
      setQuickResult({ error: err instanceof Error ? err.message : '新增失敗' });
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  const handleReplaceSubmit = async () => {
    if (isReplaceSubmitting || replacePreview.length === 0) return;
    setIsReplaceSubmitting(true);
    setReplaceResult(null);
    try {
      const res = await fetch('/api/admin/products/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: replacePreview.map(({ product, updates }) => ({
            id: product.id,
            ...updates
          }))
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '批量修改失敗');
      setReplaceResult(json);
      fetchProducts();
    } catch (err) {
      setReplaceResult({ error: err instanceof Error ? err.message : '批量修改失敗' });
    } finally {
      setIsReplaceSubmitting(false);
    }
  };
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const emptyForm = {
    name: '',
    country: '日本',
    customCountry: '',
    useCustomCountry: false,
    data_amount: '',
    validity_days: '',
    price: '',
    description: ''
  };

  const [formData, setFormData] = useState(emptyForm);
  const [editFormData, setEditFormData] = useState({ ...emptyForm, id: '' });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/products');
      const json = await res.json();
      if (json.products) {
        setProducts(json.products);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.is_active).length;
  const inactiveProducts = products.filter(p => !p.is_active).length;
  const countryOptions = Array.from(new Set([...COMMON_COUNTRIES, ...products.map(p => p.country)])).filter(Boolean);

  const handleToggleActive = async (product: Product) => {
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id, is_active: !product.is_active })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '操作失敗');
      fetchProducts();
    } catch (err: any) {
      alert('操作失敗: ' + err.message);
    }
  };

  // --- Add ---
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const country = formData.useCustomCountry ? formData.customCountry : formData.country;
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          country,
          data_amount: formData.data_amount || null,
          validity_days: Number(formData.validity_days),
          price: Number(formData.price),
          description: formData.description || null
        })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '新增失敗');
      setIsAddModalOpen(false);
      setFormData(emptyForm);
      fetchProducts();
    } catch (err: any) {
      alert('新增失敗: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Edit ---
  const openEditModal = (product: Product) => {
    const isCommon = COMMON_COUNTRIES.includes(product.country);
    setEditFormData({
      id: product.id,
      name: product.name,
      country: isCommon ? product.country : '日本',
      customCountry: isCommon ? '' : product.country,
      useCustomCountry: !isCommon,
      data_amount: product.data_amount || '',
      validity_days: String(product.validity_days),
      price: String(product.price),
      description: product.description || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const country = editFormData.useCustomCountry ? editFormData.customCountry : editFormData.country;
      const res = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editFormData.id,
          name: editFormData.name,
          country,
          data_amount: editFormData.data_amount || null,
          validity_days: Number(editFormData.validity_days),
          price: Number(editFormData.price),
          description: editFormData.description || null
        })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '更新失敗');
      setIsEditModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      alert('更新失敗: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Delete ---
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '刪除失敗');
      if (json.warning) {
        alert(json.warning);
      }
      setDeleteConfirmId(null);
      fetchProducts();
    } catch (err: any) {
      alert('刪除失敗: ' + err.message);
    }
  };

  // --- Render form fields (shared between add/edit) ---
  const renderFormFields = (
    data: typeof formData,
    setData: (d: any) => void
  ) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1">商品名稱</label>
        <input
          type="text"
          required
          placeholder="例如：日本 5日 每日1GB"
          className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40 placeholder:text-white/30"
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1">國家</label>
        <div className="flex items-center gap-2 mb-2">
          <label className="flex items-center gap-1 text-xs text-white/50 cursor-pointer">
            <input
              type="checkbox"
              checked={data.useCustomCountry}
              onChange={(e) => setData({ ...data, useCustomCountry: e.target.checked })}
              className="rounded"
            />
            自訂國家
          </label>
        </div>
        {data.useCustomCountry ? (
          <input
            type="text"
            required
            placeholder="輸入國家名稱"
            className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40 placeholder:text-white/30"
            value={data.customCountry}
            onChange={(e) => setData({ ...data, customCountry: e.target.value })}
          />
        ) : (
          <select
            required
            className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40"
            value={data.country}
            onChange={(e) => setData({ ...data, country: e.target.value })}
          >
            {COMMON_COUNTRIES.map(c => (
              <option key={c} value={c} className="text-black">{c}</option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1">流量規格</label>
        <input
          type="text"
          placeholder="例如：每日 1GB、總量 10GB、吃到飽"
          className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40 placeholder:text-white/30"
          value={data.data_amount}
          onChange={(e) => setData({ ...data, data_amount: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">有效天數</label>
          <input
            type="number"
            required
            min="1"
            placeholder="例如：5"
            className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40 placeholder:text-white/30"
            value={data.validity_days}
            onChange={(e) => setData({ ...data, validity_days: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">價格 (NT$)</label>
          <input
            type="number"
            required
            min="0"
            step="1"
            placeholder="例如：350"
            className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40 placeholder:text-white/30"
            value={data.price}
            onChange={(e) => setData({ ...data, price: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1">商品描述（選填）</label>
        <input
          type="text"
          placeholder="例如：高速穩定，暢遊日本"
          className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40 placeholder:text-white/30"
          value={data.description}
          onChange={(e) => setData({ ...data, description: e.target.value })}
        />
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-white">商品管理</h1>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={() => { setQuickForm(QUICK_DEFAULTS); setQuickResult(null); setIsQuickOpen(true); }}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-500 transition-colors flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            快速建立系列
          </button>
          <button
            onClick={() => { setReplaceForm(REPLACE_DEFAULTS); setReplaceResult(null); setIsReplaceOpen(true); }}
            className="bg-amber-500/90 text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-400 transition-colors flex items-center gap-2"
          >
            <Replace className="h-4 w-4" />
            批量替換文字
          </button>
          <button
            onClick={() => { setIsBatchOpen(true); setBatchText(''); setBatchPreview([]); setBatchResult(null); }}
            className="bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-white/20 transition-colors flex items-center gap-2"
          >
            <ClipboardList className="h-4 w-4" />
            批量匯入
          </button>
          <button
            onClick={() => { setFormData(emptyForm); setIsAddModalOpen(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-500 transition-colors shadow-lg flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            新增商品
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex items-center backdrop-blur-sm">
          <div className="p-3 rounded-full bg-blue-500/20 text-blue-400 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white/50">總商品數</p>
            <p className="text-2xl font-bold text-white">{totalProducts}</p>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex items-center backdrop-blur-sm">
          <div className="p-3 rounded-full bg-green-500/20 text-green-400 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white/50">上架中</p>
            <p className="text-2xl font-bold text-white">{activeProducts}</p>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex items-center backdrop-blur-sm">
          <div className="p-3 rounded-full bg-red-500/20 text-red-400 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white/50">已下架</p>
            <p className="text-2xl font-bold text-white">{inactiveProducts}</p>
          </div>
        </div>
      </div>

      {/* Products - Grouped by Country & Data */}
      {loading ? (
        <div className="text-center py-8 text-white/50">載入中...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-white/50">尚未建立任何商品</div>
      ) : (() => {
        // 按國家分組
        const byCountry: Record<string, Product[]> = {};
        for (const p of products) {
          if (!byCountry[p.country]) byCountry[p.country] = [];
          byCountry[p.country].push(p);
        }

        return Object.entries(byCountry).map(([country, countryProducts]) => {
          // 按流量分組
          const byData: Record<string, Product[]> = {};
          for (const p of countryProducts) {
            const key = p.data_amount || '其他';
            if (!byData[key]) byData[key] = [];
            byData[key].push(p);
          }

          const countryActive = countryProducts.filter(p => p.is_active).length;
          const countryTotal = countryProducts.length;

          return (
            <div key={country} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm mb-4">
              {/* Country Header */}
              <button
                onClick={() => toggleGroup(country)}
                className="w-full flex items-center justify-between px-6 py-4 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {({'日本':'🇯🇵','韓國':'🇰🇷','台灣':'🇹🇼','泰國':'🇹🇭','美國':'🇺🇸','法國':'🇫🇷','英國':'🇬🇧','德國':'🇩🇪','澳洲':'🇦🇺','越南':'🇻🇳','新加坡':'🇸🇬','香港':'🇭🇰','加拿大':'🇨🇦','義大利':'🇮🇹'} as Record<string,string>)[country] || '🌍'}
                  </span>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white">{country}</h3>
                    <p className="text-xs text-white/40">{Object.keys(byData).length} 種方案 · {countryActive}/{countryTotal} 上架</p>
                  </div>
                </div>
                <span className={`text-white/40 transition-transform ${collapsedGroups.has(country) ? '' : 'rotate-180'}`}>▼</span>
              </button>

              {/* Country Content */}
              {!collapsedGroups.has(country) && (
                <div className="divide-y divide-white/5">
                  {Object.entries(byData).map(([dataAmount, dataProducts]) => (
                    <div key={dataAmount}>
                      {/* Data Amount Header */}
                      <div className="px-6 py-2 bg-white/[0.02] flex items-center gap-2">
                        <span className="text-xs font-bold text-cyan-400/80">⚡</span>
                        <span className="text-sm font-bold text-white/70">{dataAmount}</span>
                        <span className="text-xs text-white/30">· {dataProducts.length} 個天數方案</span>
                      </div>
                      {/* Products in this group */}
                      {dataProducts
                        .sort((a, b) => a.validity_days - b.validity_days)
                        .map((product) => (
                        <div key={product.id} className="flex items-center justify-between px-6 py-3 hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-6 flex-1 min-w-0">
                            <span className="text-sm text-white/50 w-14 text-right">{product.validity_days}天</span>
                            <span className="text-sm text-white/90 font-medium truncate">{product.name}</span>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <span className="text-sm font-bold text-white/90">NT${product.price}</span>
                            <span className="text-xs w-12 text-center">
                              <span className={product.stock.available > 0 ? 'text-green-400' : 'text-red-400'}>{product.stock.available}</span>
                              <span className="text-white/30">/{product.stock.total}</span>
                            </span>
                            <button
                              onClick={() => handleToggleActive(product)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${product.is_active ? 'bg-green-500' : 'bg-gray-600'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${product.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                            <button onClick={() => openEditModal(product)} className="text-blue-400 hover:text-blue-300 text-xs transition-colors">編輯</button>
                            <button onClick={() => setDeleteConfirmId(product.id)} className="text-red-400 hover:text-red-300 text-xs transition-colors">刪除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        });
      })()}

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A2E] border border-white/10 rounded-xl shadow-2xl max-w-md w-full p-6 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">新增商品</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              {renderFormFields(formData, setFormData)}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-white/20 rounded-md text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white focus:outline-none transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? '處理中...' : '確認新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A2E] border border-white/10 rounded-xl shadow-2xl max-w-md w-full p-6 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">編輯商品</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              {renderFormFields(editFormData, setEditFormData)}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-white/20 rounded-md text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white focus:outline-none transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? '處理中...' : '儲存變更'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Series Modal */}
      {isQuickOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A2E] border border-white/10 rounded-xl shadow-2xl max-w-4xl w-full p-6 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">快速建立系列商品</h2>
                <p className="text-xs text-white/40 mt-1">用同一套命名規則一次產生多個天數方案</p>
              </div>
              <button onClick={() => setIsQuickOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">國家</label>
                    <select
                      className="w-full border-white/20 rounded-md p-2 border text-white bg-black/40"
                      value={quickForm.country}
                      onChange={(e) => setQuickForm({ ...quickForm, country: e.target.value })}
                    >
                      {countryOptions.map(c => <option key={c} value={c} className="text-black">{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">名稱結尾</label>
                    <input
                      className="w-full border-white/20 rounded-md p-2 border text-white bg-black/40 placeholder:text-white/30"
                      value={quickForm.suffix}
                      onChange={(e) => setQuickForm({ ...quickForm, suffix: e.target.value })}
                      placeholder="原生網路"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">商品名稱前綴</label>
                  <input
                    className="w-full border-white/20 rounded-md p-2 border text-white bg-black/40 placeholder:text-white/30"
                    value={quickForm.baseName}
                    onChange={(e) => setQuickForm({ ...quickForm, baseName: e.target.value })}
                    placeholder="日本 KDDI 不限速吃到飽"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">天數</label>
                    <input
                      className="w-full border-white/20 rounded-md p-2 border text-white bg-black/40 placeholder:text-white/30"
                      value={quickForm.days}
                      onChange={(e) => setQuickForm({ ...quickForm, days: e.target.value })}
                      placeholder="3,5,7,10,15"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">價格</label>
                    <input
                      className="w-full border-white/20 rounded-md p-2 border text-white bg-black/40 placeholder:text-white/30"
                      value={quickForm.prices}
                      onChange={(e) => setQuickForm({ ...quickForm, prices: e.target.value })}
                      placeholder="399,599,799,1299,1799"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">熱點規則</label>
                    <select
                      className="w-full border-white/20 rounded-md p-2 border text-white bg-black/40"
                      value={quickForm.hotspotMode}
                      onChange={(e) => setQuickForm({ ...quickForm, hotspotMode: e.target.value })}
                    >
                      <option value="total" className="text-black">熱點總量</option>
                      <option value="daily" className="text-black">每日熱點</option>
                      <option value="custom" className="text-black">自訂文字</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">熱點數值或文字</label>
                    <input
                      className="w-full border-white/20 rounded-md p-2 border text-white bg-black/40 placeholder:text-white/30"
                      value={quickForm.hotspotGb}
                      onChange={(e) => setQuickForm({ ...quickForm, hotspotGb: e.target.value })}
                      placeholder={quickForm.hotspotMode === 'custom' ? '熱點總量4GB' : '4'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">流量規格前綴</label>
                  <input
                    className="w-full border-white/20 rounded-md p-2 border text-white bg-black/40 placeholder:text-white/30"
                    value={quickForm.dataPrefix}
                    onChange={(e) => setQuickForm({ ...quickForm, dataPrefix: e.target.value })}
                    placeholder="不限速上網吃到飽"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">商品描述（選填）</label>
                  <input
                    className="w-full border-white/20 rounded-md p-2 border text-white bg-black/40 placeholder:text-white/30"
                    value={quickForm.description}
                    onChange={(e) => setQuickForm({ ...quickForm, description: e.target.value })}
                    placeholder="例如：KDDI 原生線路"
                  />
                </div>
              </div>

              <div>
                <p className="text-sm text-white/60 mb-2">預覽：{quickPreview.length} 筆商品</p>
                <div className="max-h-[420px] overflow-y-auto bg-black/30 rounded-lg border border-white/10">
                  <table className="w-full text-xs">
                    <thead><tr className="text-white/40 border-b border-white/10">
                      <th className="px-3 py-2 text-left">名稱</th>
                      <th className="px-3 py-2 text-right">天數</th>
                      <th className="px-3 py-2 text-right">價格</th>
                    </tr></thead>
                    <tbody>{quickPreview.map((item, i) => (
                      <tr key={`${item.name}-${i}`} className="border-b border-white/5">
                        <td className="px-3 py-2 text-white/80">{item.name}<div className="text-white/40 mt-0.5">{item.data_amount}</div></td>
                        <td className="px-3 py-2 text-right text-white/60">{item.validity_days}</td>
                        <td className={`px-3 py-2 text-right ${item.price ? 'text-white/80' : 'text-red-300'}`}>{item.price ? `NT${item.price}` : '缺價格'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>

                {quickResult && (
                  <div className={`p-4 rounded-lg mt-4 text-sm ${quickResult.error ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
                    {quickResult.error ? quickResult.error : `新增完成：成功 ${quickResult.inserted} 筆，跳過 ${quickResult.skipped} 筆`}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsQuickOpen(false)} className="px-4 py-2 border border-white/20 rounded-lg text-sm text-white/70 hover:bg-white/10">關閉</button>
              <button
                onClick={handleQuickSubmit}
                disabled={isQuickSubmitting || quickPreview.length === 0}
                className={`px-6 py-2 rounded-lg text-sm font-bold ${isQuickSubmitting || quickPreview.length === 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
              >
                {isQuickSubmitting ? '新增中...' : `確認新增 ${quickPreview.length} 筆`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Replace Modal */}
      {isReplaceOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A2E] border border-white/10 rounded-xl shadow-2xl max-w-3xl w-full p-6 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">批量替換商品文字</h2>
                <p className="text-xs text-white/40 mt-1">先預覽再更新，適合改熱點規格、線路名稱或方案描述</p>
              </div>
              <button onClick={() => setIsReplaceOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">國家範圍</label>
                <select
                  className="w-full border-white/20 rounded-md p-2 border text-white bg-black/40"
                  value={replaceForm.country}
                  onChange={(e) => setReplaceForm({ ...replaceForm, country: e.target.value })}
                >
                  <option value="全部" className="text-black">全部</option>
                  {countryOptions.map(c => <option key={c} value={c} className="text-black">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">替換欄位</label>
                <select
                  className="w-full border-white/20 rounded-md p-2 border text-white bg-black/40"
                  value={replaceForm.field}
                  onChange={(e) => setReplaceForm({ ...replaceForm, field: e.target.value as ReplaceField })}
                >
                  <option value="all" className="text-black">商品名稱 + 流量規格 + 描述</option>
                  <option value="name" className="text-black">只改商品名稱</option>
                  <option value="data_amount" className="text-black">只改流量規格</option>
                  <option value="description" className="text-black">只改商品描述</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">尋找文字</label>
                <input
                  className="w-full border-white/20 rounded-md p-2 border text-white bg-black/40 placeholder:text-white/30"
                  value={replaceForm.findText}
                  onChange={(e) => { setReplaceForm({ ...replaceForm, findText: e.target.value }); setReplaceResult(null); }}
                  placeholder="每日熱點2GB"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">替換成</label>
                <input
                  className="w-full border-white/20 rounded-md p-2 border text-white bg-black/40 placeholder:text-white/30"
                  value={replaceForm.replaceText}
                  onChange={(e) => { setReplaceForm({ ...replaceForm, replaceText: e.target.value }); setReplaceResult(null); }}
                  placeholder="熱點總量4GB"
                />
              </div>
            </div>

            <p className="text-sm text-white/60 mb-2">預覽：{replacePreview.length} 筆商品會更新</p>
            <div className="max-h-72 overflow-y-auto bg-black/30 rounded-lg border border-white/10 mb-4">
              {replacePreview.length === 0 ? (
                <div className="text-sm text-white/40 px-4 py-6 text-center">沒有找到符合的文字</div>
              ) : (
                <table className="w-full text-xs">
                  <thead><tr className="text-white/40 border-b border-white/10">
                    <th className="px-3 py-2 text-left">原商品</th>
                    <th className="px-3 py-2 text-left">更新後</th>
                  </tr></thead>
                  <tbody>{replacePreview.map(({ product, updates }) => (
                    <tr key={product.id} className="border-b border-white/5 align-top">
                      <td className="px-3 py-2 text-white/60">
                        <div>{product.name}</div>
                        <div className="text-white/35 mt-1">{product.data_amount || '-'}</div>
                      </td>
                      <td className="px-3 py-2 text-white/85">
                        <div>{updates.name || product.name}</div>
                        <div className="text-cyan-300/80 mt-1">{updates.data_amount || product.data_amount || '-'}</div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>

            {replaceResult && (
              <div className={`p-4 rounded-lg mb-4 text-sm ${replaceResult.error ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
                {replaceResult.error ? replaceResult.error : `已更新 ${replaceResult.updated} 筆商品`}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setIsReplaceOpen(false)} className="px-4 py-2 border border-white/20 rounded-lg text-sm text-white/70 hover:bg-white/10">關閉</button>
              <button
                onClick={handleReplaceSubmit}
                disabled={isReplaceSubmitting || replacePreview.length === 0 || !replaceForm.findText}
                className={`px-6 py-2 rounded-lg text-sm font-bold ${isReplaceSubmitting || replacePreview.length === 0 || !replaceForm.findText ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-400 text-black'}`}
              >
                {isReplaceSubmitting ? '更新中...' : `確認更新 ${replacePreview.length} 筆`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Import Modal */}
      {isBatchOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A2E] border border-white/10 rounded-xl shadow-2xl max-w-2xl w-full p-6 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">📋 批量匯入商品</h2>
              <button onClick={() => setIsBatchOpen(false)} className="text-white/50 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <p className="text-sm text-white/50 mb-2">從 Google 試算表複製貼上，欄位順序：<span className="text-white/70">商品名稱 → 國家 → 流量規格 → 有效天數 → 價格</span></p>
            <p className="text-xs text-white/30 mb-3">第一行如果是標題會自動跳過，重複的商品 (同名稱+國家+天數) 會自動排除</p>

            <textarea
              rows={8}
              className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-sm text-white font-mono placeholder:text-white/20 mb-3 resize-none"
              placeholder="從 Google 試算表複製貼上... 台灣5G 高速上網 1天	台灣	每日1GB	1	56"
              value={batchText}
              onChange={(e) => {
                setBatchText(e.target.value);
                setBatchPreview(parseBatchText(e.target.value));
                setBatchResult(null);
              }}
            />

            {batchPreview.length > 0 && !batchResult && (
              <div className="mb-4">
                <p className="text-sm text-white/60 mb-2">預覽：{batchPreview.length} 筆商品</p>
                <div className="max-h-48 overflow-y-auto bg-black/30 rounded-lg border border-white/10">
                  <table className="w-full text-xs">
                    <thead><tr className="text-white/40 border-b border-white/10">
                      <th className="px-3 py-1.5 text-left">名稱</th>
                      <th className="px-3 py-1.5 text-left">國家</th>
                      <th className="px-3 py-1.5 text-left">流量</th>
                      <th className="px-3 py-1.5 text-right">天數</th>
                      <th className="px-3 py-1.5 text-right">價格</th>
                    </tr></thead>
                    <tbody>{batchPreview.map((r, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="px-3 py-1.5 text-white/80">{r.name}</td>
                        <td className="px-3 py-1.5 text-white/60">{r.country}</td>
                        <td className="px-3 py-1.5 text-white/60">{r.data_amount}</td>
                        <td className="px-3 py-1.5 text-right text-white/60">{r.validity_days}</td>
                        <td className="px-3 py-1.5 text-right text-white/80">NT${r.price}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            {batchResult && (
              <div className={`p-4 rounded-lg mb-4 text-sm ${batchResult.error ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
                {batchResult.error ? (
                  <p>❌ {batchResult.error}</p>
                ) : (
                  <div>
                    <p className="font-bold mb-1">✅ 匯入完成</p>
                    <p>成功新增: {batchResult.inserted} 筆</p>
                    {batchResult.skipped > 0 && <p>跳過 (重複/無效): {batchResult.skipped} 筆</p>}
                    {batchResult.skippedItems?.map((s: any, i: number) => (
                      <p key={i} className="text-xs text-yellow-400/70 mt-1">  → {s.name}: {s.reason}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setIsBatchOpen(false)} className="px-4 py-2 border border-white/20 rounded-lg text-sm text-white/70 hover:bg-white/10">關閉</button>
              {!batchResult?.inserted && (
                <button
                  onClick={handleBatchSubmit}
                  disabled={isBatchSubmitting || batchPreview.length === 0}
                  className={`px-6 py-2 rounded-lg text-sm font-bold ${isBatchSubmitting || batchPreview.length === 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                >
                  {isBatchSubmitting ? '匯入中...' : `確認匯入 ${batchPreview.length} 筆`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A2E] border border-white/10 rounded-xl shadow-2xl max-w-sm w-full p-6 text-white">
            <h2 className="text-xl font-bold text-white mb-2">確認刪除</h2>
            <p className="text-white/60 text-sm mb-2">
              確定要刪除這個商品嗎？
            </p>
            <p className="text-red-400 text-sm mb-6">
              ⚠️ 注意：刪除商品會<strong>連帶刪除</strong>該商品下所有的 eSIM 庫存。此操作無法復原。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 border border-white/20 rounded-md text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white focus:outline-none transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none transition-colors"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
