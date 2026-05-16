'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type DBStatus = 'AVAILABLE' | 'SOLD' | 'EXPIRED';

interface EsimItem {
  id: string;
  smdpAddress: string;
  activationCode: string;
  boundProduct: string;
  status: string; // "可使用" | "已售出" | "已過期"
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    iccid: '',
    smdpAddress: 'LPA:1$smdp.plus.com', // 預設常用的 SM-DP+
    activationCode: '',
    expiryDate: '2026-12-31'
  });

  const fetchData = async () => {
    setLoading(true);
    // 1. Fetch inventory
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('e_sim_inventory')
      .select('id, iccid, smdp_address, activation_code, status, expiry_date, products(name)')
      .order('created_at', { ascending: false });

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError);
    } else if (inventoryData) {
      const formattedData: EsimItem[] = inventoryData.map((item: any) => {
        let displayStatus = '未知';
        if (item.status === 'AVAILABLE') displayStatus = '可使用';
        else if (item.status === 'SOLD') displayStatus = '已售出';
        else if (item.status === 'EXPIRED') displayStatus = '已過期';

        return {
          id: item.id,
          smdpAddress: item.smdp_address,
          activationCode: item.activation_code,
          boundProduct: item.products?.name || '未知商品',
          status: displayStatus,
          expiryDate: new Date(item.expiry_date).toLocaleDateString(),
        };
      });
      setEsims(formattedData);
    }

    // 2. Fetch products for dropdown
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, name');
    
    if (productsError) {
      console.error('Error fetching products:', productsError);
    } else if (productsData) {
      setProducts(productsData);
      if (productsData.length > 0 && !formData.productId) {
        setFormData(prev => ({ ...prev, productId: productsData[0].id }));
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case '可使用':
        return 'bg-green-100 text-green-800';
      case '已售出':
        return 'bg-blue-100 text-blue-800';
      case '已過期':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  // Delete handler
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這筆 eSIM 庫存嗎？')) return;
    
    try {
      const { error } = await supabase
        .from('e_sim_inventory')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      fetchData(); // Refresh list after successful deletion
    } catch (error: any) {
      console.error('Error deleting eSIM:', error);
      alert('刪除失敗: ' + error.message);
    }
  };

  // Edit states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: '',
    productId: '',
    iccid: '',
    smdpAddress: '',
    activationCode: '',
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
      status: rawStatus,
      expiryDate: formattedDate
    });
    
    // Fetch the specific item to get the real ICCID
    supabase
      .from('e_sim_inventory')
      .select('iccid')
      .eq('id', esim.id)
      .single()
      .then(({data}) => {
        if (data) {
          setEditFormData(prev => ({...prev, iccid: data.iccid}));
        }
      });

    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('e_sim_inventory')
        .update({
          product_id: editFormData.productId,
          iccid: editFormData.iccid,
          smdp_address: editFormData.smdpAddress,
          activation_code: editFormData.activationCode,
          status: editFormData.status,
          expiry_date: new Date(editFormData.expiryDate).toISOString()
        })
        .eq('id', editFormData.id);

      if (error) throw error;

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
      const { error } = await supabase
        .from('e_sim_inventory')
        .insert({
          product_id: formData.productId,
          iccid: formData.iccid,
          smdp_address: formData.smdpAddress,
          activation_code: formData.activationCode,
          status: 'AVAILABLE',
          expiry_date: new Date(formData.expiryDate).toISOString()
        });

      if (error) throw error;

      // 新增成功
      setIsAddModalOpen(false);
      setFormData({
        ...formData,
        iccid: '',
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
        <h1 className="text-2xl font-semibold text-gray-900">eSIM 庫存管理</h1>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-sky-400 text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-sky-500 transition-colors shadow-sm flex items-center border-2 border-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          新增 eSIM
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
          <div className="p-3 rounded-full bg-blue-50 text-blue-600 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">總庫存量</p>
            <p className="text-2xl font-bold text-gray-900">{esims.length}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
          <div className="p-3 rounded-full bg-green-50 text-green-600 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">可使用</p>
            <p className="text-2xl font-bold text-gray-900">{esims.filter(e => e.status === '可使用').length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
          <div className="p-3 rounded-full bg-red-50 text-red-600 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">已售出</p>
            <p className="text-2xl font-bold text-gray-900">{esims.filter(e => e.status === '已售出').length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SM-DP+ 位置</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">啟用碼</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">綁定商品</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">到期日</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    載入中...
                  </td>
                </tr>
              ) : esims.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    庫存中找不到任何 eSIM。
                  </td>
                </tr>
              ) : (
                esims.map((esim) => (
                  <tr key={esim.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{esim.smdpAddress}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono truncate max-w-[200px]" title={esim.activationCode}>
                      {esim.activationCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{esim.boundProduct}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(esim.status)}`}>
                        {esim.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{esim.expiryDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => openEditModal(esim)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        編輯
                      </button>
                      <button 
                        onClick={() => handleDelete(esim.id)}
                        className="text-red-600 hover:text-red-900"
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

      {/* Add eSIM Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">新增 eSIM 庫存</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">綁定商品</label>
                  <select 
                    required
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                    value={formData.productId}
                    onChange={(e) => setFormData({...formData, productId: e.target.value})}
                  >
                    <option value="" disabled>請選擇商品</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ICCID</label>
                  <input 
                    type="text" 
                    required
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                    placeholder="例如: 8901234567890123456x"
                    value={formData.iccid}
                    onChange={(e) => setFormData({...formData, iccid: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SM-DP+ 位置</label>
                  <input 
                    type="text" 
                    required
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                    value={formData.smdpAddress}
                    onChange={(e) => setFormData({...formData, smdpAddress: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">啟用碼 (Activation Code)</label>
                  <input 
                    type="text" 
                    required
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                    placeholder="例如: ABCDE-12345"
                    value={formData.activationCode}
                    onChange={(e) => setFormData({...formData, activationCode: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">到期日</label>
                  <input 
                    type="date" 
                    required
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">編輯 eSIM 庫存</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">綁定商品</label>
                  <select 
                    required
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                    value={editFormData.productId}
                    onChange={(e) => setEditFormData({...editFormData, productId: e.target.value})}
                  >
                    <option value="" disabled>請選擇商品</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
                  <select 
                    required
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  >
                    <option value="AVAILABLE">可使用</option>
                    <option value="SOLD">已售出</option>
                    <option value="EXPIRED">已過期</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ICCID</label>
                  <input 
                    type="text" 
                    required
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                    value={editFormData.iccid}
                    onChange={(e) => setEditFormData({...editFormData, iccid: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SM-DP+ 位置</label>
                  <input 
                    type="text" 
                    required
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                    value={editFormData.smdpAddress}
                    onChange={(e) => setEditFormData({...editFormData, smdpAddress: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">啟用碼 (Activation Code)</label>
                  <input 
                    type="text" 
                    required
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                    value={editFormData.activationCode}
                    onChange={(e) => setEditFormData({...editFormData, activationCode: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">到期日</label>
                  <input 
                    type="date" 
                    required
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                    value={editFormData.expiryDate}
                    onChange={(e) => setEditFormData({...editFormData, expiryDate: e.target.value})}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50"
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
