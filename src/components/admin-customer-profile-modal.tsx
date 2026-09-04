"use client";

import { useEffect, useState } from 'react';
import { BadgeCheck, ChevronDown, ChevronUp, Clock3, IdCard, Save, X, XCircle } from 'lucide-react';
import { adminFetch } from '@/lib/admin-fetch';

interface PrivateProfile {
  legal_name: string | null;
  national_id: string | null;
  birth_date: string | null;
  residential_address: string | null;
}

interface IdentityVerification {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitted_at: string;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface AdminCustomerProfile {
  id: string;
  email: string;
  name: string | null;
  private_profile: PrivateProfile | null;
  identity_verification: IdentityVerification | null;
}

interface VerificationDetail extends IdentityVerification, PrivateProfile {
  images: { idFront: string | null; idBack: string | null; selfie: string | null };
}

export default function AdminCustomerProfileModal({ customer, onClose, onChanged }: {
  customer: AdminCustomerProfile | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [legalName, setLegalName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [verification, setVerification] = useState<IdentityVerification | null>(null);
  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!customer) return;
    setLegalName(customer.private_profile?.legal_name || '');
    setNationalId(customer.private_profile?.national_id || '');
    setBirthDate(customer.private_profile?.birth_date || '');
    setResidentialAddress(customer.private_profile?.residential_address || '');
    setVerification(customer.identity_verification);
    setReviewNote(customer.identity_verification?.review_note || '');
    setDetail(null);
    setMessage('');
  }, [customer]);

  if (!customer) return null;

  const saveProfile = async () => {
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await adminFetch('/api/admin/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customer.id, legalName, nationalId, birthDate, residentialAddress })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '基本資料儲存失敗');
      setMessage('基本資料已儲存');
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '基本資料儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const toggleDocuments = async () => {
    if (!verification || loadingDocuments) return;
    if (detail) {
      setDetail(null);
      return;
    }
    setLoadingDocuments(true);
    setMessage('');
    try {
      const response = await adminFetch(`/api/admin/identity-verifications?id=${encodeURIComponent(verification.id)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '證件調閱失敗');
      setDetail(result.verification);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '證件調閱失敗');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const review = async (status: 'APPROVED' | 'REJECTED') => {
    if (!verification || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await adminFetch('/api/admin/identity-verifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: verification.id, status, reviewNote })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '審核更新失敗');
      setVerification(current => current ? { ...current, status, review_note: reviewNote || null, reviewed_at: new Date().toISOString() } : current);
      setDetail(null);
      setMessage(status === 'APPROVED' ? '實名認證已通過，證件已收起' : '已退回會員重新上傳證件');
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '審核更新失敗');
    } finally {
      setSaving(false);
    }
  };

  const statusStyle = verification?.status === 'APPROVED'
    ? 'bg-emerald-400/10 text-emerald-300'
    : verification?.status === 'REJECTED'
      ? 'bg-red-400/10 text-red-300'
      : 'bg-amber-400/10 text-amber-200';
  const StatusIcon = verification?.status === 'APPROVED' ? BadgeCheck : verification?.status === 'REJECTED' ? XCircle : Clock3;

  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
    <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-md border border-white/10 bg-[#17172a] p-5 shadow-2xl sm:rounded-md sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="text-xl font-black">會員基本資料</h2><p className="mt-1 break-all text-sm text-white/45">{customer.email}</p></div>
        <button type="button" onClick={onClose} title="關閉" className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/55 hover:bg-white/5"><X size={18} /></button>
      </div>

      <section className="mt-6 grid gap-4 border-b border-white/10 pb-6 sm:grid-cols-2">
        <label className="text-sm text-white/55">真實姓名<input value={legalName} onChange={event => setLegalName(event.target.value)} maxLength={80} className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/25 px-3 text-white outline-none focus:border-cyan/60" /></label>
        <label className="text-sm text-white/55">身分證字號<input value={nationalId} onChange={event => setNationalId(event.target.value.toUpperCase())} maxLength={30} className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/25 px-3 font-mono uppercase text-white outline-none focus:border-cyan/60" /></label>
        <label className="text-sm text-white/55">生日<input type="date" value={birthDate} onChange={event => setBirthDate(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/25 px-3 text-white outline-none focus:border-cyan/60" /></label>
        <label className="text-sm text-white/55">地址<input value={residentialAddress} onChange={event => setResidentialAddress(event.target.value)} maxLength={300} className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/25 px-3 text-white outline-none focus:border-cyan/60" /></label>
        <button type="button" onClick={() => void saveProfile()} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan px-5 font-black text-[#081318] disabled:opacity-40 sm:col-span-2 sm:justify-self-end"><Save size={17} />儲存基本資料</button>
      </section>

      <section className="pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="flex items-center gap-2 font-bold"><IdCard size={18} className="text-cyan" />租借實名認證</h3><p className="mt-1 text-xs text-white/35">證件只在管理員主動調閱後顯示，連結 5 分鐘後失效。</p></div>
          {verification ? <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-bold ${statusStyle}`}><StatusIcon size={14} />{verification.status === 'APPROVED' ? '已通過' : verification.status === 'REJECTED' ? '需補件' : '待審核'}</span> : <span className="rounded bg-white/5 px-2.5 py-1 text-xs text-white/35">尚未送出</span>}
        </div>

        {verification && <>
          <button type="button" onClick={() => void toggleDocuments()} disabled={loadingDocuments} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-white/10 px-4 text-sm font-bold text-white/65 hover:bg-white/5 disabled:opacity-40">{detail ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{loadingDocuments ? '調閱中...' : detail ? '收起證件' : '調閱證件'}</button>
          {detail && <div className="mt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{([['身分證正面', detail.images?.idFront], ['身分證反面', detail.images?.idBack], ['本人自拍照', detail.images?.selfie]] as const).map(([label, url]) => <a key={label} href={url || undefined} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border border-white/10 bg-black/20"><div className="grid aspect-[4/3] place-items-center bg-black/30 p-1">{url ? <img src={url} alt={label} className="block max-h-full max-w-full object-contain" /> : <span className="text-xs text-white/30">無法載入</span>}</div><p className="px-2 py-2 text-center text-xs text-white/55">{label} · 點選查看原圖</p></a>)}</div>
            <textarea value={reviewNote} onChange={event => setReviewNote(event.target.value)} rows={2} maxLength={500} placeholder="審核備註；退回重新上傳時必填原因" className="mt-4 w-full rounded-md border border-white/10 bg-black/25 p-3 text-sm text-white outline-none focus:border-cyan/50" />
            <div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => void review('REJECTED')} disabled={saving} className="h-10 rounded-md border border-red-400/25 px-4 text-sm font-bold text-red-200 hover:bg-red-400/10 disabled:opacity-40">退回重新上傳</button>{verification.status !== 'APPROVED' && <button type="button" onClick={() => void review('APPROVED')} disabled={saving} className="h-10 rounded-md bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-40">審核通過</button>}</div>
          </div>}
        </>}
      </section>

      {message && <p role="status" className="mt-5 rounded-md border border-cyan/15 bg-cyan/5 px-4 py-3 text-sm text-cyan-100">{message}</p>}
    </div>
  </div>;
}
