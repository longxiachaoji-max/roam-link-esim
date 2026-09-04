"use client";

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Camera, Clock3, IdCard, ShieldCheck, Upload, X } from 'lucide-react';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

type VerificationStatus = 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

interface Verification {
  status: VerificationStatus;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
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

export function IdentityVerificationModal({ open, onClose, onSubmitted }: {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
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

  const uploader = (label: string, file: File | null, setFile: (file: File | null) => void, selfieCapture = false) => (
    <label className="flex min-h-24 cursor-pointer items-center gap-4 rounded-md border border-dashed border-white/20 bg-white/[0.04] p-4 hover:bg-white/[0.07]">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-cyan-400/10 text-cyan-200">{selfieCapture ? <Camera size={21} /> : <IdCard size={21} />}</span>
      <span className="min-w-0"><span className="block text-sm font-bold text-white">{label}</span><span className="mt-1 block truncate text-xs text-white/45">{processing === label ? '正在縮小照片...' : file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : '點選拍照或選擇照片，會自動縮小上傳'}</span></span>
      <Upload className="ml-auto shrink-0 text-white/35" size={18} />
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
    </label>
  );

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
    <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-md border border-white/10 bg-[#151523] p-5 text-white shadow-2xl sm:rounded-md sm:p-7">
      <div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-bold">租借實名認證</h2><p className="mt-1 text-sm text-white/50">租借商品需先完成認證，註冊與一般購物不受影響。</p></div><button type="button" title="關閉" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md hover:bg-white/10"><X size={19} /></button></div>
      <div className="mb-5 rounded-md border border-cyan-400/20 bg-cyan-400/[0.07] p-4 text-xs leading-6 text-cyan-50/80"><ShieldCheck className="mb-2 text-cyan-300" size={20} />身分證照片會由伺服器自動加蓋「僅供一飛通租借實名認證使用」浮水印，並存放在非公開空間，僅授權後台審核人員查看。</div>
      <div className="space-y-3">{uploader('身分證正面', front, setFront)}{uploader('身分證反面', back, setBack)}{uploader('本人自拍照', selfie, setSelfie, true)}</div>
      {message && <p className="mt-4 rounded-md bg-red-400/10 px-3 py-2 text-sm text-red-200">{message}</p>}
      <button type="button" onClick={submit} disabled={saving || processing !== null || !front || !back || !selfie} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-cyan-500 font-black text-[#071317] disabled:bg-white/10 disabled:text-white/30"><ShieldCheck size={18} />{saving ? '正在安全送出...' : processing ? '正在縮小照片...' : '送出審核'}</button>
    </div>
  </div>;
}

export function IdentityVerificationCard() {
  const { verification, loading, refresh } = useIdentityVerification();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  const status = verification?.status || 'NOT_SUBMITTED';
  const Icon = status === 'APPROVED' ? BadgeCheck : status === 'PENDING' ? Clock3 : IdCard;
  return <>
    <div className="mb-10 rounded-md border border-white/8 bg-[#1a1a24] p-5">
      <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-cyan-400/10 text-cyan-300"><Icon size={21} /></span><div><h3 className="font-bold">租借實名認證</h3><p className="mt-1 text-xs leading-5 text-white/45">租借手機與設備前需完成認證；一般會員功能不受影響。</p></div></div><span className={`shrink-0 rounded px-2 py-1 text-xs font-bold ${status === 'APPROVED' ? 'bg-emerald-400/10 text-emerald-300' : status === 'PENDING' ? 'bg-amber-400/10 text-amber-200' : 'bg-white/8 text-white/55'}`}>{loading ? '讀取中' : STATUS_TEXT[status]}</span></div>
      {verification?.review_note && <p className="mt-4 rounded-md bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-200">審核說明：{verification.review_note}</p>}
      {status !== 'APPROVED' && status !== 'PENDING' && <button type="button" onClick={() => setOpen(true)} className="mt-4 h-10 rounded-md bg-cyan-500 px-4 text-sm font-black text-[#071317]">{status === 'REJECTED' ? '重新上傳資料' : '開始實名認證'}</button>}
      {status === 'PENDING' && <p className="mt-4 text-xs text-amber-100/70">資料已送出，後台審核完成後即可租借下單。</p>}
    </div>
    <IdentityVerificationModal open={open} onClose={() => setOpen(false)} onSubmitted={() => void refresh()} />
  </>;
}
