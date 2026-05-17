'use client';

import { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  country: string;
  description: string | null;
  data_amount: string | null;
  validity_days: number;
  price: number;
  created_at: string;
  stock: { available: number; total: number };
}

const COMMON_COUNTRIES = [
  '日本', '韓國', '泰國', '越南', '新加坡', '馬來西亞', '中國', '香港',
  '美國', '加拿大',
  '法國', '英國', '德國', '義大利',
  '澳洲', '紐西蘭'
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
  const withStock = products.filter(p => p.stock.available > 0).length;
  const noStock = products.filter(p => p.stock.available === 0).length;

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
        <button
          onClick={() => { setFormData(emptyForm); setIsAddModalOpen(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-500 transition-colors shadow-lg flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          新增商品
        </button>
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
            <p className="text-sm font-medium text-white/50">有庫存</p>
            <p className="text-2xl font-bold text-white">{withStock}</p>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex items-center backdrop-blur-sm">
          <div className="p-3 rounded-full bg-red-500/20 text-red-400 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white/50">無庫存</p>
            <p className="text-2xl font-bold text-white">{noStock}</p>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">名稱</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">國家</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">流量</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">天數</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">價格</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">庫存</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-white/50 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-white/50">載入中...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-white/50">尚未建立任何商品</td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/90 font-medium">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/90">{product.country}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">{product.data_amount || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">{product.validity_days}天</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/90 font-medium">NT${product.price}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={product.stock.available > 0 ? 'text-green-400' : 'text-red-400'}>
                        {product.stock.available}
                      </span>
                      <span className="text-white/30">/{product.stock.total}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEditModal(product)}
                        className="text-blue-400 hover:text-blue-300 mr-4 transition-colors"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(product.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
