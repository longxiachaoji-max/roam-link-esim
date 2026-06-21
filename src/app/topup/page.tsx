"use client";

import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowUpRight, CreditCard, Globe2, LockKeyhole, LogOut, Plane, ShieldCheck, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CustomerProfile {
  email: string;
  name: string | null;
  token_balance: number;
}

type PaymentNotice = 'success' | 'pending' | 'failed' | 'cancelled' | null;

export default function TopupPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [amount, setAmount] = useState('500');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [message, setMessage] = useState('');
  const [paymentNotice, setPaymentNotice] = useState<PaymentNotice>(null);

  const loadProfile = async (accessToken: string) => {
    const response = await fetch('/api/topup/profile', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '無法載入會員資料');
    setProfile(result.customer);
  };

  useEffect(() => {
    const initialize = async () => {
      const payment = new URLSearchParams(window.location.search).get('payment') as PaymentNotice;
      if (['success', 'pending', 'failed', 'cancelled'].includes(payment || '')) {
        setPaymentNotice(payment);
        window.history.replaceState({}, '', '/');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        try {
          await loadProfile(session.access_token);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : '無法載入會員資料');
        }
      }
      setIsLoading(false);
    };

    initialize();
    const resetPaymentState = () => setIsPaying(false);
    window.addEventListener('pageshow', resetPaymentState);
    return () => window.removeEventListener('pageshow', resetPaymentState);
  }, []);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    setIsLoggingIn(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session) {
      setMessage(error?.message || '登入失敗');
      setIsLoggingIn(false);
      return;
    }

    try {
      await loadProfile(data.session.access_token);
      setPassword('');
    } catch (loadError) {
      setMessage(loadError instanceof Error ? loadError.message : '無法載入會員資料');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setEmail('');
    setPassword('');
    setPaymentNotice(null);
  };

  const startCheckout = async () => {
    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount < 200) {
      setMessage('儲值金額最低為 NT$200');
      return;
    }
    if (numericAmount > 100000) {
      setMessage('單筆儲值金額不得超過 NT$100,000');
      return;
    }

    setMessage('');
    setPaymentNotice(null);
    setIsPaying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('登入狀態已過期，請重新登入');

      const response = await fetch('/api/ecpay/topup/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ amount: numericAmount })
      });
      const result = await response.json();
      if (!response.ok || !result.action || !result.fields) {
        throw new Error(result.error || '無法建立儲值付款');
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = result.action;
      form.style.display = 'none';
      Object.entries(result.fields as Record<string, string>).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '儲值付款建立失敗');
      setIsPaying(false);
    }
  };

  const numericAmount = Number(amount) || 0;

  return (
    <main className="min-h-screen bg-[#f3f5f4] text-[#151716]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-12 overflow-hidden bg-white">
              <Image src="/catch-the-moment-logo.jpeg" alt="拾機 Catch the Moment" fill className="object-cover object-[center_49%]" priority />
            </div>
            <div>
              <div className="text-sm font-black">拾機</div>
              <div className="text-[10px] text-black/45">catch the moment</div>
            </div>
          </div>
          {profile && (
            <button onClick={handleLogout} className="flex h-9 w-9 items-center justify-center border border-black/10 bg-white text-black/55 hover:text-black" title="登出">
              <LogOut size={17} />
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-14">
        <div className="mb-8 flex items-end justify-between border-b border-black/10 pb-6">
          <div>
            <p className="mb-2 text-xs font-bold text-[#168b55]">安全儲值付款</p>
            <h1 className="text-3xl font-black md:text-4xl">會員儲值</h1>
          </div>
          <div className="hidden items-center gap-2 text-xs text-black/45 md:flex">
            <ShieldCheck size={16} className="text-[#168b55]" />
            由綠界科技處理付款
          </div>
        </div>

        {paymentNotice && (
          <div className={`mb-6 border px-4 py-3 text-sm font-bold ${paymentNotice === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : paymentNotice === 'pending' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {paymentNotice === 'success' && '儲值成功，會員餘額已更新。'}
            {paymentNotice === 'pending' && '付款結果確認中，請稍後重新開啟頁面。'}
            {paymentNotice === 'failed' && '付款未完成，本次沒有增加餘額。'}
            {paymentNotice === 'cancelled' && '已取消付款，本次沒有增加餘額。'}
          </div>
        )}

        {isLoading ? (
          <div className="py-24 text-center text-sm text-black/45">正在載入會員資料...</div>
        ) : !profile ? (
          <div className="grid overflow-hidden border border-black/10 bg-white md:grid-cols-[0.9fr_1.1fr]">
            <div className="flex min-h-72 items-center justify-center border-b border-black/10 bg-[#fafafa] p-8 md:border-b-0 md:border-r">
              <div className="relative h-56 w-64 max-w-full overflow-hidden bg-white">
                <Image src="/catch-the-moment-logo.jpeg" alt="拾機 Catch the Moment" fill className="object-cover object-[center_49%]" priority />
              </div>
            </div>
            <form onSubmit={handleLogin} className="p-6 md:p-10">
              <div className="mb-7 flex items-center gap-3">
                <UserRound size={22} />
                <div>
                  <h2 className="text-xl font-black">會員登入</h2>
                  <p className="mt-1 text-xs text-black/45">與 First eSIM 使用相同帳號</p>
                </div>
              </div>
              <label className="mb-5 block">
                <span className="mb-2 block text-xs font-bold text-black/55">Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="h-12 w-full border border-black/15 bg-white px-4 outline-none focus:border-[#168b55]" />
              </label>
              <label className="mb-6 block">
                <span className="mb-2 block text-xs font-bold text-black/55">密碼</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="h-12 w-full border border-black/15 bg-white px-4 outline-none focus:border-[#168b55]" />
              </label>
              {message && <p className="mb-4 text-sm font-medium text-red-600">{message}</p>}
              <button type="submit" disabled={isLoggingIn} className="h-12 w-full bg-black font-bold text-white hover:bg-[#272a28] disabled:bg-black/30">
                {isLoggingIn ? '登入中...' : '登入後儲值'}
              </button>
            </form>
          </div>
        ) : (
          <div className="grid border border-black/10 bg-white lg:grid-cols-[1.15fr_0.85fr]">
            <section className="border-b border-black/10 p-6 md:p-10 lg:border-b-0 lg:border-r">
              <div className="mb-8 flex items-center justify-between bg-[#eef8f2] px-4 py-4">
                <div>
                  <p className="text-xs text-black/45">目前餘額</p>
                  <p className="mt-1 text-2xl font-black text-[#116d43]">NT${Number(profile.token_balance || 0).toLocaleString()}</p>
                </div>
                <div className="max-w-[55%] text-right text-xs text-black/50">
                  <p className="truncate font-bold text-black/70">{profile.name || profile.email.split('@')[0]}</p>
                  <p className="truncate">{profile.email}</p>
                </div>
              </div>

              <label className="block">
                <span className="mb-3 block text-sm font-black">儲值金額</span>
                <div className="flex h-16 items-center border-2 border-black bg-white px-4 focus-within:border-[#168b55]">
                  <span className="mr-3 text-lg font-bold text-black/45">NT$</span>
                  <input
                    type="number"
                    min="200"
                    max="100000"
                    step="1"
                    inputMode="numeric"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-3xl font-black outline-none"
                    aria-label="儲值金額"
                  />
                </div>
                <span className="mt-2 block text-xs text-black/40">最低儲值 NT$200</span>
              </label>

              <div className="mt-6 grid grid-cols-4 border border-black/10">
                {[200, 500, 1000, 2000].map((quickAmount, index) => (
                  <button
                    key={quickAmount}
                    type="button"
                    onClick={() => setAmount(String(quickAmount))}
                    className={`h-11 text-sm font-bold hover:bg-black hover:text-white ${index > 0 ? 'border-l border-black/10' : ''} ${numericAmount === quickAmount ? 'bg-black text-white' : 'bg-white'}`}
                  >
                    {quickAmount.toLocaleString()}
                  </button>
                ))}
              </div>
              {message && <p className="mt-4 text-sm font-medium text-red-600">{message}</p>}
            </section>

            <section className="flex flex-col justify-between bg-[#fafafa] p-6 md:p-10">
              <div>
                <h2 className="mb-6 text-sm font-black">付款摘要</h2>
                <div className="flex items-center justify-between border-b border-black/10 pb-4 text-sm">
                  <span className="text-black/50">儲值金</span>
                  <span className="font-bold">NT${numericAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-end justify-between py-5">
                  <span className="text-sm font-black">應付金額</span>
                  <span className="text-3xl font-black">NT${numericAmount.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <button onClick={startCheckout} disabled={isPaying || numericAmount < 200} className="flex h-14 w-full items-center justify-center gap-2 bg-[#168b55] font-black text-white hover:bg-[#117244] disabled:bg-black/20">
                  <CreditCard size={20} />
                  {isPaying ? '正在前往綠界...' : '信用卡付款'}
                </button>
                <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-black/45">
                  <LockKeyhole size={15} className="mt-0.5 shrink-0" />
                  <span>付款由綠界科技加密處理，系統確認付款成功後才會增加會員餘額。</span>
                </div>
              </div>
            </section>
          </div>
        )}

        <section aria-label="一飛通全球漫遊推薦" className="mt-8 overflow-hidden border border-black/10 bg-[#111827] text-white">
          <div className="grid md:grid-cols-[1.3fr_0.7fr]">
            <div className="p-6 md:p-9">
              <div className="mb-4 flex items-center gap-2 text-xs font-bold text-[#63d4e8]">
                <Plane size={16} />
                一飛通全球漫遊 eSIM
              </div>
              <h2 className="max-w-lg text-2xl font-black leading-tight md:text-3xl">出國上網，落地就能連線</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">日本、韓國、東南亞及全球多國方案，線上選購後即可取得 eSIM 安裝資訊。</p>
              <a
                href="https://firstesim.space"
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex h-12 items-center gap-2 bg-[#ff5b55] px-5 text-sm font-black text-white hover:bg-[#e94c47]"
              >
                前往一飛通漫遊
                <ArrowUpRight size={18} />
              </a>
            </div>
            <div className="flex min-h-44 items-center justify-between border-t border-white/10 bg-[#172033] px-7 py-6 md:min-h-0 md:flex-col md:justify-center md:border-l md:border-t-0">
              <Globe2 size={72} strokeWidth={1.4} className="text-[#63d4e8] md:mb-4 md:h-24 md:w-24" />
              <div className="text-right md:text-center">
                <div className="text-3xl font-black text-white">190+</div>
                <div className="mt-1 text-xs font-bold text-white/50">國家與地區上網</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
