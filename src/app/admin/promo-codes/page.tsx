'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CalendarClock, Pencil, Plus, Save, TicketPercent, Trash2, UserRound, X } from 'lucide-react';
import { adminFetch } from '@/lib/admin-fetch';
import { normalizeReferralCode } from '@/lib/referral-code';
import { discountPercentToRate, discountRateToPercent } from '@/lib/promo-discount-math';

type RewardType = 'discount' | 'tokens';
type DiscountType = 'percent' | 'fixed';
type AudienceType = 'public' | 'personal' | 'company';

interface PromoCode {
  id: string;
  code: string;
  name: string | null;
  reward_type: RewardType;
  reward_tokens: number;
  discount_type: DiscountType | null;
  discount_value: number;
  max_discount: number | null;
  min_order_amount: number;
  max_uses: number;
  max_uses_per_user: number;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  audience_type: AudienceType;
  assigned_email: string | null;
  company_name: string | null;
  allowed_email_domain: string | null;
  created_at: string;
}

interface PromoForm {
  code: string;
  name: string;
  reward_type: RewardType;
  reward_tokens: string;
  discount_type: DiscountType;
  discount_value: string;
  discount_rate: string;
  max_discount: string;
  min_order_amount: string;
  max_uses: string;
  max_uses_per_user: string;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  audience_type: AudienceType;
  assigned_email: string;
  company_name: string;
  allowed_email_domain: string;
}

const EMPTY_FORM: PromoForm = {
  code: '',
  name: '',
  reward_type: 'discount',
  reward_tokens: '100',
  discount_type: 'percent',
  discount_value: '100',
  discount_rate: '8',
  max_discount: '',
  min_order_amount: '0',
  max_uses: '100',
  max_uses_per_user: '1',
  starts_at: '',
  expires_at: '',
  is_active: true,
  audience_type: 'public',
  assigned_email: '',
  company_name: '',
  allowed_email_domain: ''
};

function dateTimeInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatDate(value: string | null) {
  if (!value) return '不限時間';
  return new Date(value).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

function statusOf(promo: PromoCode) {
  const now = Date.now();
  if (!promo.is_active) return { label: '已停用', className: 'border-white/15 bg-white/5 text-white/45' };
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) return { label: '尚未開始', className: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-200' };
  if (promo.expires_at && new Date(promo.expires_at).getTime() < now) return { label: '已過期', className: 'border-rose-400/25 bg-rose-400/10 text-rose-300' };
  if (promo.used_count >= promo.max_uses) return { label: '已用完', className: 'border-amber-400/25 bg-amber-400/10 text-amber-200' };
  return { label: '使用中', className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' };
}

function benefitLabel(promo: PromoCode) {
  if (promo.reward_type === 'tokens') return `兌換 NT$${Number(promo.reward_tokens).toLocaleString()} 儲值金`;
  if (promo.discount_type === 'fixed') return `結帳折 NT$${Number(promo.discount_value).toLocaleString()}`;
  const cap = promo.max_discount ? `，最高 NT$${Number(promo.max_discount).toLocaleString()}` : '';
  return `結帳 ${discountPercentToRate(Number(promo.discount_value))} 折${cap}`;
}

function audienceLabel(promo: PromoCode) {
  if (promo.audience_type === 'personal') return promo.assigned_email || '指定會員';
  if (promo.audience_type === 'company') {
    return `${promo.company_name || '企業優惠'}${promo.allowed_email_domain ? ` · @${promo.allowed_email_domain}` : ''}`;
  }
  return '所有會員';
}

export default function PromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const notify = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2800);
  }, []);

  const fetchPromoCodes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch('/api/admin/promo-codes', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '讀取失敗');
      setPromoCodes(result.promoCodes || []);
    } catch (error) {
      notify(error instanceof Error ? error.message : '優惠碼讀取失敗');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchPromoCodes(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPromoCodes]);

  const counts = useMemo(() => ({
    total: promoCodes.length,
    active: promoCodes.filter(promo => statusOf(promo).label === '使用中').length,
    company: promoCodes.filter(promo => promo.audience_type === 'company').length
  }), [promoCodes]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (promo: PromoCode) => {
    setEditing(promo);
    setForm({
      code: promo.code,
      name: promo.name || '',
      reward_type: promo.reward_type || 'tokens',
      reward_tokens: String(promo.reward_tokens || 0),
      discount_type: promo.discount_type || 'percent',
      discount_value: String(promo.discount_value || 0),
      discount_rate: promo.discount_type === 'percent' && Number(promo.discount_value) > 0
        ? String(discountPercentToRate(Number(promo.discount_value)))
        : '8',
      max_discount: promo.max_discount ? String(promo.max_discount) : '',
      min_order_amount: String(promo.min_order_amount || 0),
      max_uses: String(promo.max_uses || 1),
      max_uses_per_user: String(promo.max_uses_per_user || 1),
      starts_at: dateTimeInput(promo.starts_at),
      expires_at: dateTimeInput(promo.expires_at),
      is_active: promo.is_active !== false,
      audience_type: promo.audience_type || 'public',
      assigned_email: promo.assigned_email || '',
      company_name: promo.company_name || '',
      allowed_email_domain: promo.allowed_email_domain || ''
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (submitting || !form.code.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        ...form,
        code: normalizeReferralCode(form.code),
        reward_tokens: Number(form.reward_tokens),
        discount_value: form.discount_type === 'percent'
          ? discountRateToPercent(Number(form.discount_rate))
          : Number(form.discount_value),
        max_discount: form.max_discount ? Number(form.max_discount) : null,
        min_order_amount: Number(form.min_order_amount || 0),
        max_uses: Number(form.max_uses),
        max_uses_per_user: Number(form.max_uses_per_user),
        starts_at: toIso(form.starts_at),
        expires_at: toIso(form.expires_at)
      };
      const response = await adminFetch('/api/admin/promo-codes', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '儲存失敗');
      setModalOpen(false);
      notify(editing ? '優惠碼已更新' : '優惠碼已建立');
      await fetchPromoCodes();
    } catch (error) {
      notify(error instanceof Error ? error.message : '儲存失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const response = await adminFetch(`/api/admin/promo-codes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '刪除失敗');
      setDeleteConfirmId(null);
      notify('優惠碼已刪除');
      await fetchPromoCodes();
    } catch (error) {
      notify(error instanceof Error ? error.message : '刪除失敗');
    }
  };

  const actionButtons = (promo: PromoCode) => (
    <div className="flex items-center justify-end gap-2">
      <button type="button" onClick={() => openEdit(promo)} title="編輯優惠碼" className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/55 hover:border-cyan-400/30 hover:text-cyan-200">
        <Pencil size={15} />
      </button>
      {deleteConfirmId === promo.id ? (
        <>
          <button type="button" onClick={() => void remove(promo.id)} className="h-9 rounded-md border border-rose-400/30 px-3 text-xs font-bold text-rose-300 hover:bg-rose-400/10">確認刪除</button>
          <button type="button" onClick={() => setDeleteConfirmId(null)} className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/45"><X size={15} /></button>
        </>
      ) : (
        <button type="button" onClick={() => setDeleteConfirmId(promo.id)} title="刪除優惠碼" className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/40 hover:border-rose-400/30 hover:text-rose-300">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">優惠碼管理</h1>
          <p className="mt-1 text-sm text-white/40">建立公開、個人或企業優惠，結帳時直接折抵。</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan px-4 text-sm font-bold text-[#071218] hover:bg-cyan/90">
          <Plus size={17} />新增優惠碼
        </button>
      </header>

      <section className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
        {[
          ['全部', counts.total], ['使用中', counts.active], ['企業優惠', counts.company]
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-white/10 bg-white/[0.04] p-3 sm:p-5">
            <p className="text-xs text-white/40 sm:text-sm">{label}</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{value}</p>
          </div>
        ))}
      </section>

      {loading ? (
        <div className="py-16 text-center text-sm text-white/40">載入優惠碼中...</div>
      ) : promoCodes.length === 0 ? (
        <div className="rounded-md border border-dashed border-white/15 py-16 text-center text-sm text-white/40">尚未建立優惠碼</div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {promoCodes.map(promo => {
              const status = statusOf(promo);
              return (
                <article key={promo.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-bold text-white">{promo.code}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${status.className}`}>{status.label}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-white/40">{promo.name || '未命名優惠'}</p>
                    </div>
                    {actionButtons(promo)}
                  </div>
                  <p className="mt-4 text-base font-bold text-cyan-200">{benefitLabel(promo)}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div><dt className="text-white/35">適用對象</dt><dd className="mt-0.5 break-all text-white/70">{audienceLabel(promo)}</dd></div>
                    <div><dt className="text-white/35">使用次數</dt><dd className="mt-0.5 text-white/70">{promo.used_count} / {promo.max_uses}，每人 {promo.max_uses_per_user} 次</dd></div>
                    <div className="col-span-2"><dt className="text-white/35">有效期間</dt><dd className="mt-0.5 text-white/70">{formatDate(promo.starts_at)} 至 {formatDate(promo.expires_at)}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-md border border-white/10 bg-white/[0.03] md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b border-white/10 text-left text-xs text-white/40">
                  <tr><th className="p-4 font-medium">優惠碼</th><th className="p-4 font-medium">折扣內容</th><th className="p-4 font-medium">適用對象</th><th className="p-4 font-medium">有效期間</th><th className="p-4 font-medium">使用次數</th><th className="p-4 font-medium">狀態</th><th className="p-4 text-right font-medium">操作</th></tr>
                </thead>
                <tbody>
                  {promoCodes.map(promo => {
                    const status = statusOf(promo);
                    return (
                      <tr key={promo.id} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]">
                        <td className="p-4"><p className="font-mono font-bold text-white">{promo.code}</p><p className="mt-1 max-w-[180px] truncate text-xs text-white/35">{promo.name || '未命名優惠'}</p></td>
                        <td className="p-4 font-semibold text-cyan-200">{benefitLabel(promo)}{promo.min_order_amount > 0 && <p className="mt-1 text-xs font-normal text-white/35">滿 NT$ {Number(promo.min_order_amount).toLocaleString()}</p>}</td>
                        <td className="max-w-[200px] p-4 text-white/65">{audienceLabel(promo)}</td>
                        <td className="p-4 text-xs leading-5 text-white/55">{formatDate(promo.starts_at)}<br />至 {formatDate(promo.expires_at)}</td>
                        <td className="p-4 text-white/65">{promo.used_count} / {promo.max_uses}<p className="mt-1 text-xs text-white/35">每人 {promo.max_uses_per_user} 次</p></td>
                        <td className="p-4"><span className={`rounded-full border px-2.5 py-1 text-xs ${status.className}`}>{status.label}</span></td>
                        <td className="p-4">{actionButtons(promo)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/75 px-0 backdrop-blur-sm sm:items-center sm:px-4">
          <div className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-md border border-white/10 bg-[#151526] shadow-2xl sm:rounded-md">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
              <div><h2 className="text-lg font-bold text-white">{editing ? '編輯優惠碼' : '新增優惠碼'}</h2><p className="mt-0.5 text-xs text-white/35">結帳時由系統再次驗證金額、會員與有效時間。</p></div>
              <button type="button" onClick={() => setModalOpen(false)} title="關閉" className="grid h-9 w-9 place-items-center rounded-md text-white/45 hover:bg-white/5 hover:text-white"><X size={19} /></button>
            </div>

            <div className="space-y-6 overflow-y-auto px-5 py-5">
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white/80"><TicketPercent size={16} className="text-cyan-300" />優惠內容</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-white/50">優惠碼<input value={form.code} onChange={event => setForm(current => ({ ...current, code: normalizeReferralCode(event.target.value) }))} placeholder="例如 SUMMER2026" className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /></label>
                  <label className="text-xs text-white/50">內部名稱<input value={form.name} maxLength={80} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="例如 夏季日本活動" className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 text-white outline-none focus:border-cyan-400" /></label>
                  <label className="text-xs text-white/50 sm:col-span-2">用途<select value={form.reward_type} onChange={event => setForm(current => ({ ...current, reward_type: event.target.value as RewardType }))} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-[#0d0d1a] px-3 text-white outline-none focus:border-cyan-400"><option value="discount">購物車直接折扣</option><option value="tokens">兌換儲值金（保留舊代碼）</option></select></label>
                  {form.reward_type === 'discount' ? (
                    <>
                      <label className="text-xs text-white/50">折扣方式<select value={form.discount_type} onChange={event => setForm(current => ({ ...current, discount_type: event.target.value as DiscountType }))} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-[#0d0d1a] px-3 text-white outline-none focus:border-cyan-400"><option value="percent">折數優惠</option><option value="fixed">固定金額折扣</option></select></label>
                      {form.discount_type === 'percent' ? (
                        <label className="text-xs text-white/50">折數<input type="number" min="0.1" max="9.9" step="0.1" value={form.discount_rate} onChange={event => setForm(current => ({ ...current, discount_rate: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /><span className="mt-1.5 block text-[11px] text-white/35">例如：8 折代表售價的 80%，7.5 折代表售價的 75%</span></label>
                      ) : (
                        <label className="text-xs text-white/50">折抵金額 (NT$)<input type="number" min="1" step="1" value={form.discount_value} onChange={event => setForm(current => ({ ...current, discount_value: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /></label>
                      )}
                      <label className="text-xs text-white/50">最低消費 (NT$)<input type="number" min="0" value={form.min_order_amount} onChange={event => setForm(current => ({ ...current, min_order_amount: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /></label>
                      {form.discount_type === 'percent' && <label className="text-xs text-white/50">最高折抵 (NT$，選填)<input type="number" min="1" value={form.max_discount} onChange={event => setForm(current => ({ ...current, max_discount: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /></label>}
                    </>
                  ) : (
                    <label className="text-xs text-white/50 sm:col-span-2">兌換儲值金 (NT$)<input type="number" min="1" value={form.reward_tokens} onChange={event => setForm(current => ({ ...current, reward_tokens: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /></label>
                  )}
                </div>
              </section>

              {form.reward_type === 'discount' && <section>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white/80">{form.audience_type === 'personal' ? <UserRound size={16} className="text-cyan-300" /> : <Building2 size={16} className="text-cyan-300" />}適用對象</h3>
                <label className="text-xs text-white/50">優惠類型<select value={form.audience_type} onChange={event => setForm(current => ({ ...current, audience_type: event.target.value as AudienceType }))} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-[#0d0d1a] px-3 text-white outline-none focus:border-cyan-400"><option value="public">公開優惠：所有會員可用</option><option value="personal">個人優惠：指定會員 Email</option><option value="company">企業優惠：企業專屬代碼</option></select></label>
                {form.audience_type === 'personal' && <label className="mt-3 block text-xs text-white/50">指定會員 Email<input type="email" value={form.assigned_email} onChange={event => setForm(current => ({ ...current, assigned_email: event.target.value }))} placeholder="member@example.com" className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 text-white outline-none focus:border-cyan-400" /></label>}
                {form.audience_type === 'company' && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-white/50">企業名稱<input value={form.company_name} onChange={event => setForm(current => ({ ...current, company_name: event.target.value }))} placeholder="例如 XX 旅行社" className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 text-white outline-none focus:border-cyan-400" /></label><label className="text-xs text-white/50">限定 Email 網域（選填）<input value={form.allowed_email_domain} onChange={event => setForm(current => ({ ...current, allowed_email_domain: event.target.value }))} placeholder="company.com" className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /></label><p className="sm:col-span-2 text-xs leading-5 text-white/35">不填網域時，拿到代碼的會員都能使用；填入後僅限該企業 Email。</p></div>}
              </section>}

              <section>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white/80"><CalendarClock size={16} className="text-cyan-300" />期間與次數</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-white/50">開始時間（選填）<input type="datetime-local" value={form.starts_at} onChange={event => setForm(current => ({ ...current, starts_at: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 text-white outline-none focus:border-cyan-400" /></label>
                  <label className="text-xs text-white/50">結束時間（選填）<input type="datetime-local" value={form.expires_at} onChange={event => setForm(current => ({ ...current, expires_at: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 text-white outline-none focus:border-cyan-400" /></label>
                  <label className="text-xs text-white/50">總使用次數<input type="number" min={Math.max(1, editing?.used_count || 0)} value={form.max_uses} onChange={event => setForm(current => ({ ...current, max_uses: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /></label>
                  <label className="text-xs text-white/50">每位會員可用次數<input type="number" min="1" value={form.max_uses_per_user} onChange={event => setForm(current => ({ ...current, max_uses_per_user: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-black/25 px-3 font-mono text-white outline-none focus:border-cyan-400" /></label>
                </div>
                <label className="mt-4 flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70"><span><strong className="block text-white">啟用優惠碼</strong><span className="mt-0.5 block text-xs text-white/35">關閉後結帳立即停止使用，設定仍會保留。</span></span><input type="checkbox" checked={form.is_active} onChange={event => setForm(current => ({ ...current, is_active: event.target.checked }))} className="h-5 w-5 accent-cyan-400" /></label>
              </section>
            </div>

            <div className="flex shrink-0 gap-3 border-t border-white/10 bg-[#151526] px-5 py-4">
              <button type="button" onClick={() => setModalOpen(false)} className="h-11 flex-1 rounded-md border border-white/15 text-sm font-bold text-white/60 hover:bg-white/5">取消</button>
              <button type="button" onClick={() => void submit()} disabled={submitting || !form.code.trim()} className="inline-flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-md bg-cyan text-sm font-bold text-[#071218] disabled:cursor-not-allowed disabled:opacity-40"><Save size={16} />{submitting ? '儲存中...' : '儲存設定'}</button>
            </div>
          </div>
        </div>
      )}

      {message && <div className="fixed bottom-5 left-1/2 z-[300] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-md border border-white/15 bg-white px-4 py-3 text-center text-sm font-bold text-black shadow-2xl">{message}</div>}
    </div>
  );
}
