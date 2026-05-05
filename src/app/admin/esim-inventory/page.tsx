'use client';

import { useState } from 'react';

type EsimStatus = '可使用' | '已售出' | '已過期';

interface EsimItem {
  id: string;
  smdpAddress: string;
  activationCode: string;
  boundProduct: string;
  status: EsimStatus;
  expiryDate: string;
}

const mockData: EsimItem[] = [
  {
    id: '1',
    smdpAddress: 'rsp.smdp.plus',
    activationCode: '1$rsp.smdp.plus$ABCDE-12345-FGHIJ',
    boundProduct: 'Japan 5GB 7 Days',
    status: '可使用',
    expiryDate: '2024-12-31',
  },
  {
    id: '2',
    smdpAddress: 'rsp.smdp.plus',
    activationCode: '1$rsp.smdp.plus$KLMNO-67890-PQRST',
    boundProduct: 'Taiwan Unlimited 5 Days',
    status: '已售出',
    expiryDate: '2024-06-30',
  },
  {
    id: '3',
    smdpAddress: 'rsp.smdp.plus',
    activationCode: '1$rsp.smdp.plus$UVWXY-13579-ZABCD',
    boundProduct: 'Global 10GB 30 Days',
    status: '已過期',
    expiryDate: '2023-12-31',
  },
];

export default function EsimInventoryPage() {
  const [esims, setEsims] = useState<EsimItem[]>(mockData);

  const getStatusBadgeClass = (status: EsimStatus) => {
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">eSIM 庫存管理</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center">
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
              {esims.map((esim) => (
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
                    <button className="text-blue-600 hover:text-blue-900 mr-4">編輯</button>
                    <button className="text-red-600 hover:text-red-900">刪除</button>
                  </td>
                </tr>
              ))}
              {esims.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    庫存中找不到任何 eSIM。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
