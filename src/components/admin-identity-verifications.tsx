"use client";

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Clock3, IdCard, RefreshCw, XCircle } from 'lucide-react';
import { adminFetch } from '@/lib/admin-fetch';

interface Verification {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitted_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  customer: { id: string; name: string | null; email: string } | null;
  images: { idFront: string | null; idBack: string | null; selfie: string | null };
}

export default function AdminIdentityVerifications() {
  const [items, setItems] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch('/api/admin/identity-verifications', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '讀取失敗');
      setItems(result.verifications || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '讀取失敗');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const review = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setSavingId(id);
    try {
      const response = await adminFetch('/api/admin/identity-verifications', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, reviewNote: noteById[id] || '' })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '審核失敗');
      setMessage(status === 'APPROVED' ? '實名認證已通過' : '已退回會員補件');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : '審核失敗'); }
    finally { setSavingId(''); }
  };

  return <section className="mb-8 overflow-hidden rounded-md border border-white/10 bg-[#141426]">
    <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4"><div><h2 className="flex items-center gap-2 font-bold"><IdCard size={19} className="text-cyan" />租借實名認證審核</h2><p className="mt-1 text-xs text-white/40">證件連結 5 分鐘後失效，僅管理員登入後可查看。</p></div><button type="button" onClick={() => void load()} disabled={loading} title="重新整理" className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/55 hover:bg-white/5"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button></div>
    {message && <div className="border-b border-cyan-400/15 bg-cyan-400/[0.06] px-5 py-3 text-sm text-cyan-100">{message}</div>}
    {loading && items.length === 0 ? <div className="py-10 text-center text-white/35">載入認證資料中...</div> : items.length === 0 ? <div className="py-10 text-center text-white/35">目前沒有實名認證資料</div> : <div className="divide-y divide-white/8">{items.map(item => <article key={item.id} className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{item.customer?.name || '未填姓名'}</p><p className="mt-1 text-sm text-white/45">{item.customer?.email || '找不到會員資料'} · {new Date(item.submitted_at).toLocaleString('zh-TW')}</p></div><span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-bold ${item.status === 'APPROVED' ? 'bg-emerald-400/10 text-emerald-300' : item.status === 'REJECTED' ? 'bg-red-400/10 text-red-300' : 'bg-amber-400/10 text-amber-200'}`}>{item.status === 'APPROVED' ? <BadgeCheck size={14} /> : item.status === 'REJECTED' ? <XCircle size={14} /> : <Clock3 size={14} />}{item.status === 'APPROVED' ? '已通過' : item.status === 'REJECTED' ? '需補件' : '待審核'}</span></div>
      <div className="mt-4 grid grid-cols-3 gap-3">{([['身分證正面', item.images.idFront], ['身分證反面', item.images.idBack], ['本人自拍照', item.images.selfie]] as const).map(([label, url]) => <a key={label} href={url || undefined} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border border-white/10 bg-black/20"><div className="aspect-[4/3] bg-black/30">{url ? <img src={url} alt={label} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-white/30">無法載入</div>}</div><p className="px-2 py-2 text-center text-xs text-white/55">{label}</p></a>)}</div>
      <textarea value={noteById[item.id] ?? item.review_note ?? ''} onChange={event => setNoteById(current => ({ ...current, [item.id]: event.target.value }))} rows={2} placeholder="審核備註；退回補件時必填原因" className="mt-4 w-full rounded-md border border-white/10 bg-black/25 p-3 text-sm text-white outline-none focus:border-cyan/50" />
      <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => void review(item.id, 'REJECTED')} disabled={savingId === item.id} className="h-10 rounded-md border border-red-400/25 px-4 text-sm font-bold text-red-200 hover:bg-red-400/10 disabled:opacity-40">退回補件</button><button type="button" onClick={() => void review(item.id, 'APPROVED')} disabled={savingId === item.id} className="h-10 rounded-md bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-40">審核通過</button></div>
    </article>)}</div>}
  </section>;
}
