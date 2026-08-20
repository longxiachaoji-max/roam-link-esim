'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, Check, Copy, Search } from 'lucide-react';

interface CompanyDiscountResult {
  companyName: string;
  code: string;
  discountLabel: string;
  minOrderAmount: number;
  startsAt: string | null;
  expiresAt: string | null;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

export default function CompanyDiscountSearch() {
  const [company, setCompany] = useState('');
  const [results, setResults] = useState<CompanyDiscountResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    setCopiedCode('');
    try {
      const response = await fetch(`/api/company-discounts?company=${encodeURIComponent(company.trim())}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '查詢失敗');
      setResults(payload.results || []);
      setSearched(true);
    } catch (requestError) {
      setResults([]);
      setSearched(false);
      setError(requestError instanceof Error ? requestError.message : '查詢失敗');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const input = document.createElement('textarea');
      input.value = code;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(current => current === code ? '' : current), 1800);
  };

  return (
    <main className="relative z-10 min-h-screen bg-[#0d0d1a] px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white/65 hover:text-white">
            <ArrowLeft size={18} />返回首頁
          </Link>
          <p className="text-right text-sm font-bold leading-5"><span className="block text-white/55">一飛通全球漫遊</span><span className="text-coral">FirstRoamLink</span></p>
        </header>

        <section className="py-10 sm:py-16">
          <div className="mb-5 grid h-12 w-12 place-items-center rounded-md bg-cyan/10 text-cyan"><Building2 size={24} /></div>
          <h1 className="text-3xl font-black sm:text-4xl">查詢企業優惠</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-white/50 sm:text-base">輸入公司或合作企業名稱，查詢目前可使用的一飛通企業專屬代碼。</p>

          <form onSubmit={submit} className="mt-8">
            <label htmlFor="company-name" className="mb-2 block text-sm font-bold text-white/75">企業名稱</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="company-name"
                value={company}
                onChange={event => { setCompany(event.target.value.slice(0, 80)); setError(''); }}
                placeholder="例如：一飛通股份有限公司"
                autoComplete="organization"
                className="h-12 min-w-0 flex-1 rounded-md border border-white/15 bg-[#171729] px-4 text-base text-white outline-none placeholder:text-white/25 focus:border-cyan/70 focus:ring-2 focus:ring-cyan/15"
              />
              <button type="submit" disabled={loading || company.trim().length < 2} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-cyan px-6 text-sm font-black text-[#07141b] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
                <Search size={17} />{loading ? '查詢中' : '查詢代碼'}
              </button>
            </div>
            <p className={`mt-3 min-h-5 text-sm ${error ? 'text-rose-300' : 'text-white/35'}`} aria-live="polite">{error || '請輸入至少 2 個字。'}</p>
          </form>
        </section>

        <section aria-live="polite" className="space-y-3 pb-12">
          {results.map(result => {
            const start = formatDate(result.startsAt);
            const end = formatDate(result.expiresAt);
            return (
              <article key={`${result.companyName}-${result.code}`} className="rounded-md border border-white/12 bg-[#171729] p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-white/45">{result.companyName}</p>
                    <p className="mt-1 text-xl font-black text-cyan">{result.discountLabel}</p>
                    <p className="mt-2 text-xs leading-5 text-white/40">
                      {result.minOrderAmount > 0 ? `消費滿 NT$${result.minOrderAmount.toLocaleString('zh-TW')}可用` : '無最低消費限制'}
                      {(start || end) && ` · ${start || '即日起'}至${end || '另行公告'}`}
                    </p>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-md border border-white/10 bg-black/25 px-4 py-3 text-base font-bold text-white sm:min-w-44">{result.code}</code>
                    <button type="button" onClick={() => void copyCode(result.code)} title="複製企業代碼" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md border border-cyan/30 px-4 text-sm font-bold text-cyan hover:bg-cyan/10">
                      {copiedCode === result.code ? <Check size={17} /> : <Copy size={17} />}
                      {copiedCode === result.code ? '已複製' : '複製'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {searched && results.length === 0 && (
            <div className="rounded-md border border-dashed border-white/15 px-5 py-12 text-center">
              <p className="font-bold text-white/70">目前查不到這間企業的優惠</p>
              <p className="mt-2 text-sm text-white/40">請確認企業名稱，或聯繫企業窗口取得專屬代碼。</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
