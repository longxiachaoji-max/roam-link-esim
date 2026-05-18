'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type DBStatus = 'AVAILABLE' | 'SOLD' | 'EXPIRED';

interface EsimItem {
  id: string;
  smdpAddress: string;
  activationCode: string;
  boundProduct: string;
  country: string;
  dataAmount: string;
  cost: number;
  status: string;
  expiryDate: string;
}

interface Product {
  id: string;
  name: string;
}

export default function EsimInventoryPage() {
  const [esims, setEsims] = useState<EsimItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchPreview, setBatchPreview] = useState<any[]>([]);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [isPdfParsing, setIsPdfParsing] = useState(false);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsPdfParsing(true);
    setBatchResult(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const res = await fetch('/api/admin/esim-inventory/parse-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64 })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'PDF 解析失敗');
        
        if (data.items && data.items.length > 0) {
          // 將解析結果轉換為文字框內容方便預覽與修改
          const text = data.items.map((i: any) => 
            `自動解析\t${i.smdp_address}\t${i.activation_code}\t${i.iccid || ''}\t0\t`
          ).join('\n');
          setBatchText(text);
          setBatchPreview(parseBatchEsim(text));
        } else {
          alert('PDF 中沒有找到符合格式的 eSIM 資料 (需包含 LPA:1$... 字串)');
        }
      };
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsPdfParsing(false);
      e.target.value = ''; // 讓同一個檔案可以重複選取
    }
  };

  const parseBatchEsim = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];
    const startIdx = lines[0].includes('SM-DP') || lines[0].includes('smdp') || lines[0].includes('商品') ? 1 : 0;
    return lines.slice(startIdx).map(line => {
      const cols = line.split('\t');
      return {
        product_name: cols[0]?.trim() || '',
        smdp_address: cols[1]?.trim() || '',
        activation_code: cols[2]?.trim() || '',
        iccid: cols[3]?.trim() || '',
        cost: cols[4]?.trim() || '',
        expiry_date: cols[5]?.trim() || '',
      };
    }).filter(r => r.smdp_address && r.activation_code);
  };

  const handleBatchEsimSubmit = async () => {
    if (isBatchSubmitting || batchPreview.length === 0) return;
    setIsBatchSubmitting(true);
    setBatchResult(null);
    try {
      const res = await fetch('/api/admin/esim-inventory/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batchPreview })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '匯入失敗');
      setBatchResult(json);
      fetchData();
    } catch (err: any) {
      setBatchResult({ error: err.message });
    } finally {
      setIsBatchSubmitting(false);
    }
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    iccid: '',
    smdpAddress: 'LPA:1$smdp.plus.com', // 預設常用的 SM-DP+
    activationCode: '',
    cost: '',
    expiryDate: '2026-12-31'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch inventory via API route (uses service_role key)
      const invRes = await fetch('/api/admin/esim-inventory');
      const invJson = await invRes.json();

      if (invJson.error) {
        console.error('Error fetching inventory:', invJson.error);
      } else if (invJson.inventory) {
        const formattedData: EsimItem[] = invJson.inventory.map((item: any) => {
          let displayStatus = '未知';
          if (item.status === 'AVAILABLE') displayStatus = '可使用';
          else if (item.status === 'SOLD') displayStatus = '已售出';
          else if (item.status === 'EXPIRED') displayStatus = '已過期';

          return {
            id: item.id,
            smdpAddress: item.smdp_address,
            activationCode: item.activation_code,
            boundProduct: item.products?.name || '未知商品',
            country: item.products?.country || '未分類',
            dataAmount: item.products?.data_amount || '其他',
            cost: Number(item.cost || 0),
            status: displayStatus,
            expiryDate: new Date(item.expiry_date).toLocaleDateString(),
          };
        });
        setEsims(formattedData);
      }

      // 2. Fetch products for dropdown (anon key is fine for read-only products)
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, country, data_amount')
        .order('country', { ascending: true })
        .order('data_amount', { ascending: true })
        .order('name', { ascending: true });
      
      if (productsError) {
        console.error('Error fetching products:', productsError);
      } else if (productsData) {
        setProducts(productsData);
        if (productsData.length > 0 && !formData.productId) {
          setFormData(prev => ({ ...prev, productId: productsData[0].id }));
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case '可使用':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case '已售出':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case '已過期':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };


  // Delete handler - 透過 API route 使用 service_role key
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這筆 eSIM 庫存嗎？')) return;
    
    try {
      const res = await fetch(`/api/admin/esim-inventory?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '刪除失敗');
      fetchData(); // Refresh list after successful deletion
    } catch (error: any) {
      console.error('Error deleting eSIM:', error);
      alert('刪除失敗: ' + error.message);
    }
  };

  // Edit states
  // Collapse state
  const [collapsedCountries, setCollapsedCountries] = useState<Set<string>>(new Set());
  const toggleCountry = (c: string) => {
    setCollapsedCountries(prev => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c); else n.add(c);
      return n;
    });
  };
  const FLAG_MAP: Record<string, string> = {
    '日本':'🇯🇵','韓國':'🇰🇷','台灣':'🇹🇼','泰國':'🇹🇭','美國':'🇺🇸','法國':'🇫🇷',
    '英國':'🇬🇧','德國':'🇩🇪','澳洲':'🇦🇺','越南':'🇻🇳','新加坡':'🇸🇬','香港':'🇭🇰',
    '加拿大':'🇨🇦','義大利':'🇮🇹','馬來西亞':'🇲🇾','中國':'🇨🇳'
  };

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: '',
    productId: '',
    iccid: '',
    smdpAddress: '',
    activationCode: '',
    cost: '',
    status: '',
    expiryDate: ''
  });

  const openEditModal = (esim: EsimItem) => {
    // We need to find the raw product ID based on the boundProduct string (since we only saved the name in esims state)
    // A better approach would be to store productId in EsimItem, but we'll do a quick lookup for now
    const product = products.find(p => p.name === esim.boundProduct);
    
    // Convert status back to DB format
    let rawStatus = 'AVAILABLE';
    if (esim.status === '已售出') rawStatus = 'SOLD';
    if (esim.status === '已過期') rawStatus = 'EXPIRED';

    // Format date string for the input field (YYYY-MM-DD)
    // The previous string might be "M/D/YYYY" from toLocaleDateString
    // Let's ensure it's in YYYY-MM-DD format for the input[type="date"]
    let formattedDate = '';
    try {
      const d = new Date(esim.expiryDate);
      formattedDate = d.toISOString().split('T')[0];
    } catch(e) {
      formattedDate = new Date().toISOString().split('T')[0];
    }

    setEditFormData({
      id: esim.id,
      productId: product?.id || '',
      iccid: '', // Note: we didn't fetch iccid into EsimItem initially, so we have to re-fetch or just handle what we have
      smdpAddress: esim.smdpAddress,
      activationCode: esim.activationCode,
      cost: '',
      status: rawStatus,
      expiryDate: formattedDate
    });
    
    // Fetch the specific item to get the real ICCID and cost via API
    fetch('/api/admin/esim-inventory')
      .then(res => res.json())
      .then(json => {
        const match = json.inventory?.find((inv: any) => inv.id === esim.id);
        if (match) {
          setEditFormData(prev => ({...prev, iccid: match.iccid || '', cost: match.cost ? String(match.cost) : '0'}));
        }
      });

    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/esim-inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editFormData.id,
          product_id: editFormData.productId,
          iccid: editFormData.iccid,
          smdp_address: editFormData.smdpAddress,
          activation_code: editFormData.activationCode,
          status: editFormData.status,
          expiry_date: editFormData.expiryDate,
          cost: editFormData.cost
        })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '更新失敗');

      setIsEditModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error updating eSIM:', error);
      alert('更新失敗: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/esim-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: formData.productId,
          iccid: formData.iccid,
          smdp_address: formData.smdpAddress,
          activation_code: formData.activationCode,
          expiry_date: formData.expiryDate,
          cost: formData.cost
        })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '新增失敗');

      // 新增成功
      setIsAddModalOpen(false);
      setFormData({
        ...formData,
        iccid: '',
        cost: '',
        activationCode: '' // 只清空輸入碼的部分，保留商品和日期的預設
      });
      fetchData(); // 重新整理列表
    } catch (error: any) {
      console.error('Error adding eSIM:', error);
      alert('新增失敗: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-white">eSIM 庫存管理</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setIsBatchOpen(true); setBatchText(''); setBatchPreview([]); setBatchResult(null); }}
            className="bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-white/20 transition-colors flex items-center gap-1"
          >
            📋 批量匯入
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-500 transition-colors shadow-lg flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            新增 eSIM
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex items-center backdrop-blur-sm">
          <div className="p-3 rounded-full bg-blue-500/20 text-blue-400 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white/50">總庫存量</p>
            <p className="text-2xl font-bold text-white">{esims.length}</p>
          </div>
        </div>
        
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex items-center backdrop-blur-sm">
          <div className="p-3 rounded-full bg-green-500/20 text-green-400 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white/50">可使用</p>
            <p className="text-2xl font-bold text-white">{esims.filter(e => e.status === '可使用').length}</p>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex items-center backdrop-blur-sm">
          <div className="p-3 rounded-full bg-red-500/20 text-red-400 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white/50">已售出</p>
            <p className="text-2xl font-bold text-white">{esims.filter(e => e.status === '已售出').length}</p>
          </div>
        </div>
      </div>

      {/* Grouped Inventory */}
      {loading ? (
        <div className="text-center py-8 text-white/50">載入中...</div>
      ) : esims.length === 0 ? (
        <div className="text-center py-8 text-white/50">庫存中找不到任何 eSIM。</div>
      ) : (() => {
        const byCountry: Record<string, EsimItem[]> = {};
        for (const e of esims) {
          if (!byCountry[e.country]) byCountry[e.country] = [];
          byCountry[e.country].push(e);
        }
        return Object.entries(byCountry).map(([country, items]) => {
          const byData: Record<string, EsimItem[]> = {};
          for (const e of items) {
            if (!byData[e.dataAmount]) byData[e.dataAmount] = [];
            byData[e.dataAmount].push(e);
          }
          const avail = items.filter(e => e.status === '可使用').length;
          const sold = items.filter(e => e.status === '已售出').length;
          return (
            <div key={country} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm mb-4">
              <button
                onClick={() => toggleCountry(country)}
                className="w-full flex items-center justify-between px-6 py-4 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{FLAG_MAP[country] || '🌍'}</span>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white">{country}</h3>
                    <p className="text-xs text-white/40">
                      {items.length} 筆 · <span className="text-green-400">{avail} 可用</span> · <span className="text-blue-400">{sold} 已售</span>
                    </p>
                  </div>
                </div>
                <span className={`text-white/40 transition-transform ${collapsedCountries.has(country) ? '' : 'rotate-180'}`}>▼</span>
              </button>
              {!collapsedCountries.has(country) && (
                <div className="divide-y divide-white/5">
                  {Object.entries(byData).map(([dataAmount, dataItems]) => {
                    const dAvail = dataItems.filter(e => e.status === '可使用').length;
                    return (
                      <div key={dataAmount}>
                        <div className="px-6 py-2 bg-white/[0.02] flex items-center gap-2">
                          <span className="text-xs font-bold text-cyan-400/80">⚡</span>
                          <span className="text-sm font-bold text-white/70">{dataAmount}</span>
                          <span className="text-xs text-white/30">· {dataItems.length} 筆 · {dAvail} 可用</span>
                        </div>
                        {dataItems.map((esim) => (
                          <div key={esim.id} className="flex items-center justify-between px-6 py-2.5 hover:bg-white/5 transition-colors gap-2">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${getStatusBadgeClass(esim.status)}`}>
                                {esim.status}
                              </span>
                              <span className="text-sm text-white/70 truncate" title={esim.boundProduct}>{esim.boundProduct}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 text-xs">
                              <span className="text-white/40 font-mono truncate max-w-[120px]" title={esim.activationCode}>
                                {esim.activationCode.length > 12 ? esim.activationCode.slice(0, 12) + '…' : esim.activationCode}
                              </span>
                              {esim.cost > 0 && <span className="text-yellow-400/70">NT${esim.cost}</span>}
                              <span className="text-white/30">{esim.expiryDate}</span>
                              <button onClick={() => openEditModal(esim)} className="text-blue-400 hover:text-blue-300 transition-colors">編輯</button>
                              <button onClick={() => handleDelete(esim.id)} className="text-red-400 hover:text-red-300 transition-colors">刪除</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        });
      })()}

      {/* Batch Import Modal */}
      {isBatchOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A2E] border border-white/10 rounded-xl shadow-2xl max-w-2xl w-full p-6 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">📋 批量匯入 eSIM</h2>
              <button onClick={() => setIsBatchOpen(false)} className="text-white/50 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <p className="text-sm text-white/50 mb-2">從 Google 試算表複製貼上，欄位順序：<span className="text-white/70">商品名稱 → SM-DP+ → 啟用碼 → ICCID(選填) → 成本(選填) → 到期日(選填)</span></p>
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs text-white/30">商品名稱會自動比對現有商品，啟用碼重複的會自動排除</p>
              
              <label className={`cursor-pointer px-3 py-1.5 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 text-xs font-bold border border-purple-500/30 transition-colors flex items-center gap-1 ${isPdfParsing ? 'opacity-50 pointer-events-none' : ''}`}>
                {isPdfParsing ? '⏳ 讀取中...' : '📄 匯入 PDF (自動解析)'}
                <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
              </label>
            </div>

            <textarea
              rows={8}
              className="w-full bg-black/40 border border-white/20 rounded-lg p-3 text-sm text-white font-mono placeholder:text-white/20 mb-3 resize-none"
              placeholder="從 Google 試算表複製貼上... 台灣5G 1天	smdp.example.com	ACTIVATION123	ICCID123	50	2026-12-31"
              value={batchText}
              onChange={(e) => {
                setBatchText(e.target.value);
                setBatchPreview(parseBatchEsim(e.target.value));
                setBatchResult(null);
              }}
            />

            {batchPreview.length > 0 && !batchResult && (
              <div className="mb-4">
                <p className="text-sm text-white/60 mb-2">預覽：{batchPreview.length} 筆 eSIM</p>
                <div className="max-h-48 overflow-y-auto bg-black/30 rounded-lg border border-white/10">
                  <table className="w-full text-xs">
                    <thead><tr className="text-white/40 border-b border-white/10">
                      <th className="px-2 py-1.5 text-left">商品</th>
                      <th className="px-2 py-1.5 text-left">SM-DP+</th>
                      <th className="px-2 py-1.5 text-left">啟用碼</th>
                      <th className="px-2 py-1.5 text-left">ICCID</th>
                      <th className="px-2 py-1.5 text-right">成本</th>
                    </tr></thead>
                    <tbody>{batchPreview.map((r, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="px-2 py-1.5 text-white/60 truncate max-w-[120px]">{r.product_name || '-'}</td>
                        <td className="px-2 py-1.5 text-white/60 truncate max-w-[120px]">{r.smdp_address}</td>
                        <td className="px-2 py-1.5 text-white/80 font-mono truncate max-w-[100px]">{r.activation_code}</td>
                        <td className="px-2 py-1.5 text-white/40">{r.iccid || '-'}</td>
                        <td className="px-2 py-1.5 text-right text-white/60">{r.cost || '-'}</td>
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
                      <p key={i} className="text-xs text-yellow-400/70 mt-1">  → {s.activation_code}: {s.reason}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setIsBatchOpen(false)} className="px-4 py-2 border border-white/20 rounded-lg text-sm text-white/70 hover:bg-white/10">關閉</button>
              {!batchResult?.inserted && (
                <button
                  onClick={handleBatchEsimSubmit}
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

      {/* Add eSIM Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A2E] border border-white/10 rounded-xl shadow-2xl max-w-md w-full p-6 text-white">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">新增 eSIM 庫存</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">綁定商品</label>
                  <select 
                    required
                    className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40"
                    value={formData.productId}
                    onChange={(e) => setFormData({...formData, productId: e.target.value})}
                  >
                    <option value="" disabled className="text-black">請選擇商品</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id} className="text-black">[{(p as any).country}] {(p as any).data_amount} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">ICCID <span className="text-white/30">(選填)</span></label>
                  <input 
                    type="text" 
                    className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40 placeholder:text-white/30"
                    placeholder="例如: 8901234567890123456x (可留空)"
                    value={formData.iccid}
                    onChange={(e) => setFormData({...formData, iccid: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">SM-DP+ 位置</label>
                  <input 
                    type="text" 
                    required
                    className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40"
                    value={formData.smdpAddress}
                    onChange={(e) => setFormData({...formData, smdpAddress: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">啟用碼 (Activation Code)</label>
                  <input 
                    type="text" 
                    required
                    className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40 placeholder:text-white/30"
                    placeholder="例如: ABCDE-12345"
                    value={formData.activationCode}
                    onChange={(e) => setFormData({...formData, activationCode: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">到期日</label>
                  <input 
                    type="date" 
                    required
                    className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">成本 (NT$)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="1"
                    className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40 placeholder:text-white/30"
                    placeholder="例如: 150"
                    value={formData.cost}
                    onChange={(e) => setFormData({...formData, cost: e.target.value})}
                  />
                </div>
              </div>
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

      {/* Edit eSIM Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A2E] border border-white/10 rounded-xl shadow-2xl max-w-md w-full p-6 text-white">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">編輯 eSIM 庫存</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">綁定商品</label>
                  <select 
                    required
                    className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40"
                    value={editFormData.productId}
                    onChange={(e) => setEditFormData({...editFormData, productId: e.target.value})}
                  >
                    <option value="" disabled className="text-black">請選擇商品</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id} className="text-black">[{(p as any).country}] {(p as any).data_amount} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">狀態</label>
                  <select 
                    required
                    className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40"
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  >
                    <option value="AVAILABLE" className="text-black">可使用</option>
                    <option value="SOLD" className="text-black">已售出</option>
                    <option value="EXPIRED" className="text-black">已過期</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">ICCID <span className="text-white/30">(選填)</span></label>
                  <input 
                    type="text" 
                    className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40"
                    value={editFormData.iccid}
                    onChange={(e) => setEditFormData({...editFormData, iccid: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">SM-DP+ 位置</label>
                  <input 
                    type="text" 
                    required
                    className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40"
                    value={editFormData.smdpAddress}
                    onChange={(e) => setEditFormData({...editFormData, smdpAddress: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">啟用碼 (Activation Code)</label>
                  <input 
                    type="text" 
                    required
                    className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40"
                    value={editFormData.activationCode}
                    onChange={(e) => setEditFormData({...editFormData, activationCode: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">到期日</label>
                  <input 
                    type="date" 
                    required
                    className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40"
                    value={editFormData.expiryDate}
                    onChange={(e) => setEditFormData({...editFormData, expiryDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">成本 (NT$)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="1"
                    className="w-full border-white/20 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border text-white bg-black/40 placeholder:text-white/30"
                    placeholder="例如: 150"
                    value={editFormData.cost}
                    onChange={(e) => setEditFormData({...editFormData, cost: e.target.value})}
                  />
                </div>
              </div>
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
    </div>
  );
}
