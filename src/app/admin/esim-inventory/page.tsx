'use client';

import { useState } from 'react';

type EsimStatus = 'Available' | 'Sold' | 'Expired';

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
    status: 'Available',
    expiryDate: '2024-12-31',
  },
  {
    id: '2',
    smdpAddress: 'rsp.smdp.plus',
    activationCode: '1$rsp.smdp.plus$KLMNO-67890-PQRST',
    boundProduct: 'Taiwan Unlimited 5 Days',
    status: 'Sold',
    expiryDate: '2024-06-30',
  },
  {
    id: '3',
    smdpAddress: 'rsp.smdp.plus',
    activationCode: '1$rsp.smdp.plus$UVWXY-13579-ZABCD',
    boundProduct: 'Global 10GB 30 Days',
    status: 'Expired',
    expiryDate: '2023-12-31',
  },
];

export default function EsimInventoryPage() {
  const [esims, setEsims] = useState<EsimItem[]>(mockData);

  const getStatusBadgeClass = (status: EsimStatus) => {
    switch (status) {
      case 'Available':
        return 'bg-green-100 text-green-800';
      case 'Sold':
        return 'bg-blue-100 text-blue-800';
      case 'Expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">eSIM Inventory</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
          Add eSIM
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SM-DP+ Address</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activation Code</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bound Product</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
                    <button className="text-blue-600 hover:text-blue-900 mr-4">Edit</button>
                    <button className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              ))}
              {esims.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No eSIMs found in inventory.
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
