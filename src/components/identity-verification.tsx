"use client";

import { useCallback, useEffect, useState } from 'react';
import { Camera, Clock3, IdCard, RefreshCw, ShieldCheck, Upload, UserRound, X } from 'lucide-react';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

type VerificationStatus = 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

interface Verification {
  status: VerificationStatus;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  legal_name?: string | null;
  national_id?: string | null;
  birth_date?: string | null;
  residential_address?: string | null;
}

interface IdentityPhotoUploaderProps {
  label: string;
  file: File | null;
  setFile: (file: File | null) => void;
  processing: boolean;
  setProcessing: (label: string | null) => void;
  setMessage: (message: string) => void;
  selfieCapture?: boolean;
}

const MAX_UPLOAD_BYTES = 750_000;
const MAX_IMAGE_EDGE = 1600;

async function loadBrowserImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } catch {
    throw new Error('照片格式無法讀取，請改用 JPG 或重新拍照');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressIdentityPhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('請選擇照片檔案');
  if (file.size <= MAX_UPLOAD_BYTES && file.type === 'image/jpeg') return file;

  const image = await loadBrowserImage(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('瀏覽器無法處理照片，請重新拍照');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.84;
  let blob: Blob | null = null;
  do {
    blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    quality -= 0.1;
  } while (blob && blob.size > MAX_UPLOAD_BYTES && quality >= 0.44);
  if (!blob) throw new Error('照片壓縮失敗，請重新選擇照片');
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('照片內容過大，請靠近證件重新拍攝');
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

function IdentityPhotoUploader({
  label,
  file,
  setFile,
  processing,
  setProcessing,
  setMessage,
  selfieCapture = false
}: IdentityPhotoUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return <label className="block cursor-pointer overflow-hidden rounded-md border border-dashed border-white/20 bg-white/[0.04] transition-colors hover:bg-white/[0.07]">
    <span className="relative grid aspect-[16/9] w-full place-items-center overflow-hidden bg-black/25">
      {previewUrl
        ? <img src={previewUrl} alt={`${label}預覽`} className="h-full w-full object-contain" />
        : <span className="flex flex-col items-center gap-2 text-white/40">{selfieCapture ? <Camera size={28} /> : <IdCard size={28} />}<span className="text-xs">點選拍照或選擇照片</span></span>}
      {previewUrl && !selfieCapture && <span className="pointer-events-none absolute left-1/2 top-1/2 w-[92%] -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] rounded bg-black/55 px-2 py-2 text-center text-[10px] font-bold leading-4 text-white/90 sm:text-xs">僅供一飛通租借實名認證使用</span>}
      {processing && <span className="absolute inset-0 grid place-items-center bg-black/65 text-sm font-bold text-white">正在縮小照片...</span>}
      {previewUrl && <span className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-md bg-black/65 text-white" title="更換照片"><Upload size={17} /></span>}
    </span>
    <span className="flex items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{label}</span><span className="mt-1 block truncate text-xs text-white/45">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : '照片會自動縮小後上傳'}</span></span>
      {!previewUrl && <Upload className="shrink-0 text-white/35" size={18} />}
    </span>
    <input type="file" accept="image/*" capture={selfieCapture ? 'user' : 'environment'} className="hidden" onChange={async event => {
      const selected = event.target.files?.[0];
      if (!selected) return;
      setProcessing(label);
      setMessage('');
      try {
        setFile(await compressIdentityPhoto(selected));
      } catch (error) {
        setFile(null);
        setMessage(error instanceof Error ? error.message : '照片處理失敗');
      } finally {
        setProcessing(null);
        event.target.value = '';
      }
    }} />
  </label>;
}

const STATUS_TEXT: Record<VerificationStatus, string> = {
  NOT_SUBMITTED: '尚未認證',
  PENDING: '審核中',
  APPROVED: '已完成認證',
  REJECTED: '需要補件'
};

export function useIdentityVerification() {
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authenticatedFetch('/api/member/identity-verification', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '讀取實名認證失敗');
      setVerification(result.verification);
      return result.verification as Verification;
    } finally {
      setLoading(false);
    }
  }, []);
  return { verification, loading, refresh, setVerification };
}

export function IdentityVerificationModal({ open, onClose, onSubmitted, replacing = false }: {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  replacing?: boolean;
}) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  if (!open) return null;

  const submit = async () => {
    if (!front || !back || !selfie || saving) return setMessage('請完成三張照片上傳');
    setSaving(true);
    setMessage('');
    const submissionId = crypto.randomUUID();
    try {
      const upload = async (kind: string, file: File) => {
        const form = new FormData();
        form.set('submissionId', submissionId);
        form.set('kind', kind);
        form.set('file', file);
        const response = await authenticatedFetch('/api/member/identity-verification', { method: 'POST', body: form });
        const result = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
        if (!response.ok) throw new Error(result?.error || (response.status === 413 ? '照片仍然過大，請重新拍照後再試' : `照片上傳失敗（${response.status}）`));
      };
      const uploads = await Promise.allSettled([
        upload('id-front', front),
        upload('id-back', back),
        upload('selfie', selfie)
      ]);
      const failedUpload = uploads.find(result => result.status === 'rejected');
      if (failedUpload?.status === 'rejected') throw failedUpload.reason;
      const response = await authenticatedFetch('/api/member/identity-verification', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '送出失敗');
      onSubmitted?.();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '送出失敗');
      void authenticatedFetch(`/api/member/identity-verification?submissionId=${encodeURIComponent(submissionId)}`, { method: 'DELETE' });
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
    <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-md border border-white/10 bg-[#151523] p-5 text-white shadow-2xl sm:rounded-md sm:p-7">
      <div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-bold">租借實名認證</h2><p className="mt-1 text-sm text-white/50">租借商品需先完成認證，註冊與一般購物不受影響。</p></div><button type="button" title="關閉" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md hover:bg-white/10"><X size={19} /></button></div>
      {replacing && <div className="mb-5 rounded-md border border-amber-300/20 bg-amber-300/[0.08] px-4 py-3 text-xs leading-5 text-amber-100">重新送出證件後會進入再次審核；審核期間暫時無法建立新的租借訂單。舊證件不會顯示於前台。</div>}
      <div className="mb-5 rounded-md border border-cyan-400/20 bg-cyan-400/[0.07] p-4 text-xs leading-6 text-cyan-50/80"><ShieldCheck className="mb-2 text-cyan-300" size={20} />身分證照片會由伺服器自動加蓋「僅供一飛通租借實名認證使用」浮水印，並存放在非公開空間，僅授權後台審核人員查看。</div>
      <div className="space-y-3">
        <IdentityPhotoUploader label="身分證正面" file={front} setFile={setFront} processing={processing === '身分證正面'} setProcessing={setProcessing} setMessage={setMessage} />
        <IdentityPhotoUploader label="身分證反面" file={back} setFile={setBack} processing={processing === '身分證反面'} setProcessing={setProcessing} setMessage={setMessage} />
        <IdentityPhotoUploader label="本人自拍照" file={selfie} setFile={setSelfie} processing={processing === '本人自拍照'} setProcessing={setProcessing} setMessage={setMessage} selfieCapture />
      </div>
      {message && <p className="mt-4 rounded-md bg-red-400/10 px-3 py-2 text-sm text-red-200">{message}</p>}
      <button type="button" onClick={submit} disabled={saving || processing !== null || !front || !back || !selfie} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-cyan-500 font-black text-[#071317] disabled:bg-white/10 disabled:text-white/30"><ShieldCheck size={18} />{saving ? '正在安全送出...' : processing ? '正在縮小照片...' : '送出審核'}</button>
    </div>
  </div>;
}

function IdentityProfileModal({ verification, open, onClose, onSaved }: {
  verification: Verification;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [legalName, setLegalName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setLegalName(verification.legal_name || '');
    setNationalId(verification.national_id || '');
    setBirthDate(verification.birth_date || '');
    setResidentialAddress(verification.residential_address || '');
    setMessage('');
  }, [open, verification]);

  if (!open) return null;
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await authenticatedFetch('/api/member/identity-verification', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legalName, nationalId, birthDate, residentialAddress })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '會員資料儲存失敗');
      await onSaved();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '會員資料儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[91] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
    <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-md border border-white/10 bg-[#151523] p-5 text-white shadow-2xl sm:rounded-md sm:p-7">
      <div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-bold">會員資料</h2><p className="mt-1 text-sm text-white/50">資料僅供租借身分核對，不會顯示於商城頁面。</p></div><button type="button" title="關閉" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md hover:bg-white/10"><X size={19} /></button></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-white/60">真實姓名<input value={legalName} onChange={event => setLegalName(event.target.value)} maxLength={80} autoComplete="name" className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 text-white outline-none focus:border-cyan-400/60" /></label>
        <label className="text-sm text-white/60">身分證字號<input value={nationalId} onChange={event => setNationalId(event.target.value.toUpperCase())} maxLength={30} autoCapitalize="characters" className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 font-mono uppercase text-white outline-none focus:border-cyan-400/60" /></label>
        <label className="text-sm text-white/60">生日<input type="date" value={birthDate} onChange={event => setBirthDate(event.target.value)} max={new Date().toISOString().slice(0, 10)} className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 text-white outline-none focus:border-cyan-400/60" /></label>
        <label className="text-sm text-white/60 sm:col-span-2">地址<input value={residentialAddress} onChange={event => setResidentialAddress(event.target.value)} maxLength={300} autoComplete="street-address" className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 text-white outline-none focus:border-cyan-400/60" /></label>
      </div>
      {message && <p role="alert" className="mt-4 rounded-md bg-red-400/10 px-3 py-2 text-sm text-red-200">{message}</p>}
      <button type="button" onClick={() => void save()} disabled={saving} className="mt-5 h-12 w-full rounded-md bg-cyan-500 font-black text-[#071317] disabled:opacity-40">{saving ? '儲存中...' : '儲存會員資料'}</button>
    </div>
  </div>;
}

export function IdentityVerificationCard() {
  const { verification, loading, refresh } = useIdentityVerification();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  if (loading || !verification) return null;
  if (verification.status === 'APPROVED') return <>
    <div className="mb-6 flex flex-wrap justify-end gap-2">
      <button type="button" onClick={() => setProfileOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-white/65 hover:bg-white/[0.08]"><UserRound size={15} />會員資料</button>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-white/65 hover:bg-white/[0.08]"><RefreshCw size={14} />更新證件</button>
    </div>
    <IdentityProfileModal verification={verification} open={profileOpen} onClose={() => setProfileOpen(false)} onSaved={refresh} />
    <IdentityVerificationModal open={open} onClose={() => setOpen(false)} onSubmitted={() => void refresh()} replacing />
  </>;
  const status = verification.status;
  const Icon = status === 'PENDING' ? Clock3 : IdCard;
  return <>
    <div className="mb-10 rounded-md border border-white/8 bg-[#1a1a24] p-5">
      <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-cyan-400/10 text-cyan-300"><Icon size={21} /></span><div><h3 className="font-bold">租借實名認證</h3><p className="mt-1 text-xs leading-5 text-white/45">租借手機與設備前需完成認證；一般會員功能不受影響。</p></div></div><span className={`shrink-0 rounded px-2 py-1 text-xs font-bold ${status === 'PENDING' ? 'bg-amber-400/10 text-amber-200' : 'bg-white/8 text-white/55'}`}>{STATUS_TEXT[status]}</span></div>
      {verification?.review_note && <p className="mt-4 rounded-md bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-200">審核說明：{verification.review_note}</p>}
      {status !== 'PENDING' && <button type="button" onClick={() => setOpen(true)} className="mt-4 h-10 rounded-md bg-cyan-500 px-4 text-sm font-black text-[#071317]">{status === 'REJECTED' ? '重新上傳資料' : '開始實名認證'}</button>}
      {status === 'PENDING' && <p className="mt-4 text-xs text-amber-100/70">資料已送出，後台審核完成後即可租借下單。</p>}
    </div>
    <IdentityVerificationModal open={open} onClose={() => setOpen(false)} onSubmitted={() => void refresh()} />
  </>;
}
