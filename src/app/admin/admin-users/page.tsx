"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ShieldPlus, Trash2 } from 'lucide-react';
import { adminFetch } from '@/lib/admin-fetch';

interface AdminUser {
  user_id: string;
  email: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    const response = await adminFetch('/api/admin/admin-users', { cache: 'no-store' });
    const result = await response.json();
    if (response.ok) setAdmins(result.admins || []);
    else setMessage(result.error || '讀取後台人員失敗');
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAdmins(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAdmins]);

  const createAdmin = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    const response = await adminFetch('/api/admin/admin-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || '新增失敗');
      return;
    }
    setEmail('');
    setPassword('');
    setMessage('已新增後台人員');
    await loadAdmins();
  };

  const removeAdmin = async (admin: AdminUser) => {
    if (!window.confirm(`確定移除 ${admin.email} 的後台權限？`)) return;
    const response = await adminFetch('/api/admin/admin-users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: admin.user_id })
    });
    const result = await response.json();
    setMessage(response.ok ? '已移除後台權限' : result.error || '移除失敗');
    if (response.ok) await loadAdmins();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black">後台人員</h1>
        <p className="text-gray-400 mt-1">管理可登入正式後台的帳號</p>
      </div>

      <form onSubmit={createAdmin} className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end border-b border-white/10 pb-8">
        <label className="block">
          <span className="block text-sm text-gray-400 mb-2">Email</span>
          <input type="email" value={email} onChange={event => setEmail(event.target.value)} required className="w-full bg-[#151529] border border-white/15 rounded-md px-4 py-3 outline-none focus:border-cyan" />
        </label>
        <label className="block">
          <span className="block text-sm text-gray-400 mb-2">初始密碼（至少 12 碼）</span>
          <input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} required className="w-full bg-[#151529] border border-white/15 rounded-md px-4 py-3 outline-none focus:border-cyan" />
        </label>
        <button className="h-[50px] inline-flex items-center justify-center gap-2 bg-cyan text-[#0B0B1A] px-5 rounded-md font-black">
          <ShieldPlus size={19} />新增
        </button>
      </form>

      {message && <p role="status" className="text-yellow">{message}</p>}
      <div className="border border-white/10 rounded-md overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] bg-white/5 px-4 py-3 text-sm text-gray-400">
          <span>管理員 Email</span><span>操作</span>
        </div>
        {loading ? <p className="px-4 py-6 text-gray-400">載入中...</p> : admins.map(admin => (
          <div key={admin.user_id} className="grid grid-cols-[1fr_auto] items-center px-4 py-4 border-t border-white/10">
            <div>
              <p className="font-medium break-all">{admin.email}</p>
              <p className="text-xs text-gray-500 mt-1">加入於 {new Date(admin.created_at).toLocaleString('zh-TW')}</p>
            </div>
            <button onClick={() => removeAdmin(admin)} title="移除後台權限" className="p-2 text-red-400 hover:bg-red-500/10 rounded-md">
              <Trash2 size={19} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
