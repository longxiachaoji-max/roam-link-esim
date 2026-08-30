'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Building2, ChevronRight, LogOut, Mail, Minus, Plus, RefreshCw, Send, WalletCards } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { getEsimCountryInfo } from '@/lib/esim-country-info';

interface Dealer {
  id: string;
  email: string;
  store_name: string;
  contact_name: string | null;
  phone: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  price_rate_percent: number;
  balance: number;
}
interface Product {
  id: string; name: string; country: string; description: string | null; data_amount: string | null;
  validity_days: number; retail_price: number; dealer_price: number;
}
interface DealerOrder {
  id: string; customer_email: string; dealer_total: number; created_at: string;
  orders: { order_number: string; order_status: string } | { order_number: string; order_status: string }[];
  dealer_order_items: Array<{
    id: string;
    delivery_email_status: string;
    delivery_email_error: string | null;
    products: { name: string; country: string; validity_days: number } | { name: string; country: string; validity_days: number }[];
    order_items: {
      inventory_id: string | null;
      supplier_status: string | null;
      e_sim_inventory: {
        iccid: string | null;
        microesim_usage_cache: { status?: string } | null;
        microesim_usage_checked_at: string | null;
      } | {
        iccid: string | null;
        microesim_usage_cache: { status?: string } | null;
        microesim_usage_checked_at: string | null;
      }[];
    } | {
      inventory_id: string | null;
      supplier_status: string | null;
      e_sim_inventory: {
        iccid: string | null;
        microesim_usage_cache: { status?: string } | null;
        microesim_usage_checked_at: string | null;
      } | {
        iccid: string | null;
        microesim_usage_cache: { status?: string } | null;
        microesim_usage_checked_at: string | null;
      }[];
    }[];
  }>;
}
interface Transaction { id: string; amount: number; balance_after: number; reason: string; created_at: string; }

const APPLICATION_KEY = 'firstroamlink-dealer-application';

function money(value: number) { return `NT$${Number(value || 0).toLocaleString('zh-TW')}`; }
function first<T>(value: T | T[]) { return Array.isArray(value) ? value[0] : value; }
function installStatus(item: DealerOrder['dealer_order_items'][number]) {
  const orderItem = first(item.order_items);
  const inventory = orderItem ? first(orderItem.e_sim_inventory) : null;
  if (!orderItem?.inventory_id) return 'eSIM 準備中';
  return inventory?.microesim_usage_cache?.status || '尚未安裝';
}

export default function DealerPage() {
  const [checking, setChecking] = useState(true);
  const [sessionEmail, setSessionEmail] = useState('');
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<DealerOrder[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [view, setView] = useState<'sale' | 'orders' | 'balance'>('sale');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [application, setApplication] = useState({ storeName: '', contactName: '', phone: '', taxId: '' });
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [topupNote, setTopupNote] = useState('');
  const [orderEmails, setOrderEmails] = useState<Record<string, string>>({});
  const [sendingOrderId, setSendingOrderId] = useState('');
  const customerEmailRef = useRef<HTMLInputElement>(null);
  const salesCatalogRef = useRef<HTMLElement>(null);

  const loadOrders = useCallback(async () => {
    const response = await authenticatedFetch('/api/dealer/orders', { cache: 'no-store' });
    const result = await response.json();
    if (response.ok) setOrders(result.orders || []);
  }, []);

  const loadAccount = useCallback(async () => {
    setChecking(true);
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    setSessionEmail(session?.user.email || '');
    if (!session) {
      setDealer(null); setChecking(false); return;
    }
    const response = await authenticatedFetch('/api/dealer/profile', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || '讀取帳號失敗'); setChecking(false); return;
    }
    setDealer(result.dealer || null);
    setTransactions(result.transactions || []);
    if (result.dealer?.status === 'approved') {
      const productResponse = await authenticatedFetch('/api/dealer/products', { cache: 'no-store' });
      const productResult = await productResponse.json();
      if (productResponse.ok) setProducts(productResult.products || []);
      await loadOrders();
    }
    setChecking(false);
  }, [loadOrders]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAccount(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAccount]);

  const submitApplication = async (form = application) => {
    const response = await authenticatedFetch('/api/dealer/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '送出申請失敗');
    localStorage.removeItem(APPLICATION_KEY);
    setDealer(result.dealer);
    setMessage('申請已送出，待後台審核開通');
  };

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (authMode === 'register') {
        if (!application.storeName || !application.contactName || !application.phone) throw new Error('請填寫完整店家資料');
        const result = await supabase.auth.signUp({ email: email.trim(), password });
        const isExistingAccountError = result.error?.code === 'user_already_exists'
          || /already (registered|exists)/i.test(result.error?.message || '');
        if (result.error && !isExistingAccountError) throw result.error;
        const isExistingMember = isExistingAccountError || result.data.user?.identities?.length === 0;
        if (isExistingMember) {
          const signIn = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (signIn.error) throw new Error('這個 Email 已是一般會員，請輸入原會員密碼後再送出申請');
          await submitApplication();
        } else if (result.data.session) {
          await submitApplication();
        } else {
          localStorage.setItem(APPLICATION_KEY, JSON.stringify(application));
          setMessage('註冊完成，請先到信箱完成驗證，再回來登入送出經銷商申請');
        }
      } else {
        const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
        const saved = localStorage.getItem(APPLICATION_KEY);
        if (saved) await submitApplication(JSON.parse(saved));
        await loadAccount();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : '操作失敗'); }
    finally { setBusy(false); }
  };

  const sendExistingMemberApplication = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await submitApplication(); } catch (error) { setMessage(error instanceof Error ? error.message : '送出失敗'); }
    finally { setBusy(false); }
  };

  const countries = useMemo(
    () => Array.from(new Set(products.map(item => item.country))).sort((a, b) => a.localeCompare(b, 'zh-TW')),
    [products]
  );
  const availableDays = useMemo(
    () => Array.from(new Set(products
      .filter(product => product.country === selectedCountry)
      .map(product => product.validity_days)))
      .sort((a, b) => a - b),
    [products, selectedCountry]
  );
  const filteredProducts = useMemo(
    () => products.filter(product => product.country === selectedCountry && product.validity_days === selectedDays),
    [products, selectedCountry, selectedDays]
  );
  const cartItems = products.filter(product => cart[product.id]).map(product => ({ ...product, quantity: cart[product.id] }));
  const cartTotal = cartItems.reduce((sum, item) => sum + item.dealer_price * item.quantity, 0);

  const showCatalogTop = () => window.requestAnimationFrame(() => {
    salesCatalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const chooseCountry = (countryName: string) => {
    setSelectedCountry(countryName);
    setSelectedDays(null);
    showCatalogTop();
  };

  const returnToCountries = () => {
    setSelectedCountry('');
    setSelectedDays(null);
    showCatalogTop();
  };

  const changeQuantity = (id: string, delta: number) => setCart(current => {
    const quantity = Math.max(0, Math.min(20, (current[id] || 0) + delta));
    const next = { ...current };
    if (quantity) next[id] = quantity; else delete next[id];
    return next;
  });

  const createOrder = async () => {
    const productIds = cartItems.flatMap(item => Array(item.quantity).fill(item.id));
    if (!productIds.length) return setMessage('請先選擇商品');
    setBusy(true); setMessage('');
    try {
      const response = await authenticatedFetch('/api/dealer/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerEmail, customerName, productIds })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '下單失敗');
      setCart({}); setCustomerEmail(''); setCustomerName('');
      setDealer(current => current ? { ...current, balance: result.newBalance } : current);
      setMessage(`訂單 ${result.orderNumber} 已建立${result.pendingCount ? '，eSIM 完成後會自動寄出' : '，安裝資料已寄給客戶'}`);
      await Promise.all([loadOrders(), loadAccount()]);
    } catch (error) { setMessage(error instanceof Error ? error.message : '下單失敗'); }
    finally { setBusy(false); }
  };

  const handleOrderAction = () => {
    if (!customerEmail.trim()) {
      setMessage('請先填寫客戶 Email，eSIM 安裝資料會寄到這個信箱');
      customerEmailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => customerEmailRef.current?.focus(), 350);
      return;
    }
    void createOrder();
  };

  const resendOrderEmail = async (order: DealerOrder) => {
    const nextEmail = (orderEmails[order.id] ?? order.customer_email).trim();
    setSendingOrderId(order.id); setMessage('');
    try {
      const response = await authenticatedFetch('/api/dealer/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealerOrderId: order.id, customerEmail: nextEmail })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '再次寄送失敗');
      setMessage(result.sentCount
        ? `已更新 Email，並重新寄送 ${result.sentCount} 封 eSIM 安裝信`
        : '已更新 Email，eSIM 配發完成後會自動寄送');
      setOrderEmails(current => ({ ...current, [order.id]: nextEmail }));
      await loadOrders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '再次寄送失敗');
      await loadOrders();
    } finally {
      setSendingOrderId('');
    }
  };

  const requestTopup = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await authenticatedFetch('/api/dealer/topups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: topupAmount, note: topupNote })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '申請失敗');
      setTopupAmount(''); setTopupNote(''); setMessage('加值申請已送出，收到現金並核准後會顯示在餘額中');
      await loadAccount();
    } catch (error) { setMessage(error instanceof Error ? error.message : '申請失敗'); }
    finally { setBusy(false); }
  };

  const logout = async () => { await supabase.auth.signOut(); setDealer(null); setSessionEmail(''); setProducts([]); };

  if (checking) return <main className="min-h-screen grid place-items-center bg-[#090916] text-white"><RefreshCw className="animate-spin text-[#55d5ea]" /></main>;

  if (!sessionEmail) return (
    <main className="min-h-screen bg-[#090916] px-5 py-10 text-white">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm text-white/45 hover:text-white">← 返回一飛通全球漫遊</Link>
        <div className="mt-10 border-b border-white/10 pb-7"><Building2 className="mb-5 text-[#55d5ea]" size={36} /><h1 className="text-3xl font-black">經銷商專區</h1><p className="mt-2 text-white/50">代客選購、餘額管理與訂單進度</p></div>
        <div className="mt-7 grid grid-cols-2 border-b border-white/10"><button onClick={() => setAuthMode('login')} className={`py-3 font-semibold ${authMode === 'login' ? 'border-b-2 border-[#ff4f73] text-white' : 'text-white/40'}`}>登入</button><button onClick={() => setAuthMode('register')} className={`py-3 font-semibold ${authMode === 'register' ? 'border-b-2 border-[#ff4f73] text-white' : 'text-white/40'}`}>申請經銷商</button></div>
        <form onSubmit={handleAuth} className="mt-6 space-y-4">
          {authMode === 'register' && <><p className="text-sm leading-6 text-white/50">已有一飛通一般會員帳號，可直接輸入原 Email 與密碼申請，不需要重新註冊。</p><ApplicationFields value={application} onChange={setApplication} /></>}
          <Field label="Email"><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="field" /></Field>
          <Field label="密碼"><input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="field" /></Field>
          <button disabled={busy} className="h-12 w-full rounded-md bg-[#ff4f73] font-black disabled:opacity-50">{busy ? '處理中...' : authMode === 'login' ? '登入經銷商專區' : '送出經銷商申請'}</button>
        </form>
        {message && <p role="status" className="mt-5 border-l-2 border-[#55d5ea] pl-3 text-sm text-white/70">{message}</p>}
      </div>
    </main>
  );

  if (!dealer) return (
    <main className="min-h-screen bg-[#090916] px-5 py-10 text-white"><div className="mx-auto max-w-lg"><div className="flex justify-between"><Link href="/" className="text-white/50">← 返回首頁</Link><button onClick={logout} className="text-white/50">登出</button></div><h1 className="mt-10 text-3xl font-black">申請經銷商帳號</h1><p className="mt-2 text-white/50">目前登入：{sessionEmail}</p><form onSubmit={sendExistingMemberApplication} className="mt-7 space-y-4"><ApplicationFields value={application} onChange={setApplication} /><button disabled={busy} className="h-12 w-full rounded-md bg-[#ff4f73] font-black">送出審核</button></form>{message && <p className="mt-4 text-[#55d5ea]">{message}</p>}</div></main>
  );

  if (dealer.status !== 'approved') {
    const content = dealer.status === 'pending' ? ['申請審核中', '後台審核開通後，即可查看經銷價格與代客下單。'] : dealer.status === 'rejected' ? ['申請未通過', '請確認店家資料或聯繫客服後重新申請。'] : ['帳號目前停用', '請聯繫客服確認帳號狀態。'];
    return <main className="min-h-screen grid place-items-center bg-[#090916] px-5 text-white"><div className="w-full max-w-md"><Building2 className="mb-5 text-[#55d5ea]" size={38}/><h1 className="text-3xl font-black">{content[0]}</h1><p className="mt-3 text-white/50">{content[1]}</p><p className="mt-6 border-y border-white/10 py-4">{dealer.store_name}<br/><span className="text-sm text-white/40">{dealer.email}</span></p><div className="mt-6 flex gap-3">{dealer.status === 'rejected' && <button onClick={() => setDealer(null)} className="rounded-md bg-[#ff4f73] px-5 py-3 font-bold">重新申請</button>}<button onClick={logout} className="rounded-md border border-white/15 px-5 py-3">登出</button></div>{message && <p className="mt-4 text-[#55d5ea]">{message}</p>}</div></main>;
  }

  return (
    <main className="min-h-screen bg-[#090916] text-white">
      <header className="border-b border-white/10 bg-[#101020] px-4 py-4"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><p className="text-xs text-white/40">一飛通經銷商</p><h1 className="font-bold">{dealer.store_name}</h1></div><div className="flex items-center gap-3"><div className="rounded-md border border-amber-300/25 bg-amber-300/8 px-3 py-2 text-right"><p className="text-[11px] text-white/40">可用餘額</p><p className="font-black text-amber-300">{money(dealer.balance)}</p></div><button onClick={logout} title="登出" className="p-3 text-white/45"><LogOut size={20}/></button></div></div></header>
      <nav className="sticky top-0 z-20 border-b border-white/10 bg-[#090916]/95 px-4 backdrop-blur"><div className="mx-auto flex max-w-7xl gap-6">{([['sale','代客販售'],['orders','經銷訂單'],['balance','加值與帳本']] as const).map(([key,label]) => <button key={key} onClick={() => setView(key)} className={`py-4 text-sm font-bold ${view === key ? 'border-b-2 border-[#ff4f73]' : 'text-white/40'}`}>{label}</button>)}</div></nav>
      <div className={`mx-auto max-w-7xl px-4 pt-7 ${view === 'sale' && cartItems.length ? 'pb-28 lg:pb-7' : 'pb-7'}`}>
        {message && <div className="mb-6 border-l-2 border-[#55d5ea] bg-white/5 px-4 py-3 text-sm">{message}</div>}
        {view === 'sale' && <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <section ref={salesCatalogRef} className="scroll-mt-20">
            {!selectedCountry ? (
              <>
                <div>
                  <p className="text-sm font-bold text-[#55d5ea]">代客販售</p>
                  <h2 className="mt-1 text-2xl font-black">選擇 eSIM 國家</h2>
                  <p className="mt-2 text-sm text-white/40">點選客戶要前往的國家，再選擇使用天數與方案。</p>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {countries.map(item => {
                    const info = getEsimCountryInfo(item);
                    const dayCount = new Set(products.filter(product => product.country === item).map(product => product.validity_days)).size;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => chooseCountry(item)}
                        className="group flex min-h-28 flex-col items-start justify-between rounded-xl border border-white/10 bg-[#121222] p-4 text-left transition hover:border-[#55d5ea]/50 hover:bg-[#18182b]"
                      >
                        <span className="text-3xl" aria-hidden="true">{info.flag}</span>
                        <span className="mt-4 flex w-full items-end justify-between gap-2">
                          <span><span className="block font-black">{item}</span><span className="mt-0.5 block text-xs text-white/35">{dayCount} 種天數</span></span>
                          <ChevronRight size={18} className="mb-1 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-[#55d5ea]" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={returnToCountries}
                  className="inline-flex items-center gap-2 text-sm font-bold text-white/50 hover:text-white"
                >
                  <ArrowLeft size={17} />返回選擇國家
                </button>
                <div className="mt-5 flex items-center gap-4 border-b border-white/10 pb-5">
                  <span className="text-4xl" aria-hidden="true">{getEsimCountryInfo(selectedCountry).flag}</span>
                  <div><p className="text-sm text-[#55d5ea]">代客販售</p><h2 className="text-2xl font-black">{selectedCountry} eSIM</h2></div>
                </div>
                <div className="py-6">
                  <h3 className="font-black">選擇使用天數</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {availableDays.map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setSelectedDays(days)}
                        className={`min-w-20 rounded-md border px-4 py-3 font-black transition ${selectedDays === days ? 'border-[#ff4f73] bg-[#ff4f73] text-white' : 'border-white/12 bg-white/5 text-white/65 hover:border-white/30 hover:text-white'}`}
                      >
                        {days} 天
                      </button>
                    ))}
                  </div>
                </div>
                {selectedDays === null ? (
                  <div className="rounded-xl border border-dashed border-white/12 px-5 py-10 text-center text-sm text-white/35">請先選擇客戶要使用的天數</div>
                ) : (
                  <div>
                    <div className="mb-3 flex items-end justify-between gap-3"><h3 className="text-lg font-black">{selectedDays} 天方案</h3><span className="text-xs text-white/35">共 {filteredProducts.length} 個方案</span></div>
                    <div className="divide-y divide-white/8 border-y border-white/10">
                      {filteredProducts.map(product => (
                        <article key={product.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                          <div><p className="font-semibold">{product.name}</p><p className="mt-1 text-sm text-white/40">{product.country} · {product.validity_days} 天{product.data_amount ? ` · ${product.data_amount}` : ''}</p></div>
                          <div className="flex items-center justify-between gap-4 sm:justify-end"><div className="text-right"><p className="font-black text-[#55d5ea]">{money(product.dealer_price)}</p><p className="text-xs text-white/30 line-through">售價 {money(product.retail_price)}</p></div><button onClick={() => changeQuantity(product.id, 1)} title={`加入 ${product.name}`} className="grid size-10 place-items-center rounded-md bg-[#ff4f73]"><Plus size={20}/></button></div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
          <aside className="lg:sticky lg:top-20 lg:self-start"><h2 className="text-xl font-black">本次代客訂單</h2><div className="mt-4 divide-y divide-white/8 border-y border-white/10">{cartItems.length ? cartItems.map(item => <div key={item.id} className="py-3"><p className="text-sm font-medium">{item.name}</p><div className="mt-2 flex items-center justify-between"><span className="text-[#55d5ea]">{money(item.dealer_price * item.quantity)}</span><div className="flex items-center gap-3"><button onClick={() => changeQuantity(item.id,-1)} className="p-1"><Minus size={17}/></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id,1)} className="p-1"><Plus size={17}/></button></div></div></div>) : <p className="py-7 text-sm text-white/35">尚未選擇商品</p>}</div><div className="flex justify-between py-4 text-lg font-black"><span>經銷扣款</span><span>{money(cartTotal)}</span></div><Field label="客戶 Email（安裝資料寄送至此）"><input ref={customerEmailRef} type="email" required value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="field" placeholder="customer@example.com"/></Field><div className="mt-3"><Field label="客戶姓名（選填）"><input value={customerName} onChange={e => setCustomerName(e.target.value)} className="field"/></Field></div><button onClick={handleOrderAction} disabled={busy || !cartItems.length} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#ff4f73] font-black disabled:opacity-40"><Send size={18}/>{busy ? '建立中...' : '扣款並寄送 eSIM'}</button><p className="mt-3 text-xs leading-5 text-white/35">系統會將 QR Code 與一鍵安裝連結直接寄給客戶。客戶使用相同 Email 登入一飛通後，也可在會員中心查看。</p></aside>
        </div>}
        {view === 'orders' && (
          <section>
            <div className="flex items-end justify-between">
              <div><h2 className="text-2xl font-black">經銷訂單</h2><p className="mt-1 text-sm text-white/40">最近 50 筆代客販售</p></div>
              <button onClick={loadOrders} title="重新整理" className="p-2 text-white/50"><RefreshCw size={19}/></button>
            </div>
            <div className="mt-5 space-y-4">
              {orders.length ? orders.map(order => {
                const normal = first(order.orders);
                const draftEmail = orderEmails[order.id] ?? order.customer_email;
                return (
                  <article key={order.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                    <div className="grid gap-3 md:grid-cols-[160px_1fr_auto] md:items-start">
                      <div>
                        <p className="font-mono text-sm">{normal?.order_number}</p>
                        <p className="mt-1 text-xs text-white/35">{new Date(order.created_at).toLocaleString('zh-TW')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/45">收件 Email</p>
                        <p className="break-all font-medium">{order.customer_email}</p>
                      </div>
                      <div className="md:text-right">
                        <p className="font-black text-amber-300">{money(order.dealer_total)}</p>
                        <p className="mt-1 text-xs text-[#55d5ea]">{order.dealer_order_items.every(item => item.delivery_email_status === 'sent') ? '已寄送安裝資料' : normal?.order_status === 'COMPLETED' ? '寄送處理中' : 'eSIM 準備中'}</p>
                      </div>
                    </div>

                    <div className="mt-4 divide-y divide-white/8 border-y border-white/8">
                      {order.dealer_order_items.map(item => {
                        const product = first(item.products);
                        const orderItem = first(item.order_items);
                        const inventory = orderItem ? first(orderItem.e_sim_inventory) : null;
                        return (
                          <div key={item.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_210px_110px] sm:items-center">
                            <div>
                              <p className="font-medium">{product?.name}</p>
                              <p className="mt-1 text-xs text-white/35">{product?.country} · {product?.validity_days} 天</p>
                            </div>
                            <p className="break-all font-mono text-xs text-white/60"><span className="font-sans text-white/35">ICCID：</span>{inventory?.iccid || '配發中'}</p>
                            <p className={`font-bold ${installStatus(item) === '尚未安裝' ? 'text-white/50' : 'text-emerald-300'}`}>{installStatus(item)}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input
                        type="email"
                        aria-label={`${normal?.order_number || '訂單'}收件 Email`}
                        value={draftEmail}
                        onChange={event => setOrderEmails(current => ({ ...current, [order.id]: event.target.value }))}
                        className="field"
                        placeholder="customer@example.com"
                      />
                      <button
                        type="button"
                        onClick={() => void resendOrderEmail(order)}
                        disabled={sendingOrderId === order.id || !draftEmail.trim()}
                        className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#ff4f73] px-5 font-black disabled:opacity-45"
                      >
                        {sendingOrderId === order.id ? <RefreshCw size={17} className="animate-spin" /> : <Mail size={17} />}
                        {sendingOrderId === order.id ? '寄送中...' : '更新 Email 並再次寄送'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-white/30">再次寄送不會重複扣款；修改 Email 後，會員中心訂單也會改綁定到新 Email。</p>
                  </article>
                );
              }) : <p className="py-12 text-center text-white/35">尚無經銷訂單</p>}
            </div>
          </section>
        )}
        {view === 'balance' && <div className="grid gap-8 lg:grid-cols-[360px_1fr]"><section><WalletCards className="text-amber-300"/><h2 className="mt-4 text-2xl font-black">申請現金加值</h2><p className="mt-2 text-sm leading-6 text-white/45">先向一飛通完成現金付款，再送出申請。後台核准後餘額才會增加。</p><form onSubmit={requestTopup} className="mt-6 space-y-4"><Field label="申請金額"><input type="number" min="1" max="1000000" required value={topupAmount} onChange={e => setTopupAmount(e.target.value)} className="field"/></Field><Field label="付款備註（選填）"><textarea rows={3} value={topupNote} onChange={e => setTopupNote(e.target.value)} className="field py-3" placeholder="例如：現金交付日期"/></Field><button disabled={busy} className="h-12 w-full rounded-md bg-[#ff4f73] font-black">送出加值申請</button></form></section><section><h2 className="text-2xl font-black">餘額帳本</h2><div className="mt-5 divide-y divide-white/8 border-y border-white/10">{transactions.length ? transactions.map(transaction => <div key={transaction.id} className="grid grid-cols-[1fr_auto] gap-3 py-4"><div><p>{transaction.reason}</p><p className="mt-1 text-xs text-white/35">{new Date(transaction.created_at).toLocaleString('zh-TW')} · 餘額 {money(transaction.balance_after)}</p></div><p className={`font-black ${transaction.amount > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{transaction.amount > 0 ? '+' : ''}{money(transaction.amount)}</p></div>) : <p className="py-10 text-center text-white/35">尚無餘額紀錄</p>}</div></section></div>}
      </div>
      {view === 'sale' && cartItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#101020]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_32px_rgba(0,0,0,0.45)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/45">{cartItems.reduce((sum, item) => sum + item.quantity, 0)} 件 eSIM</p>
              <p className="truncate text-lg font-black text-[#55d5ea]">{money(cartTotal)}</p>
            </div>
            <button onClick={handleOrderAction} disabled={busy} className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-[#ff4f73] px-5 font-black disabled:opacity-50">
              <Send size={18}/>{busy ? '建立中...' : '扣款並寄送 eSIM'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm text-white/50">{label}</span>{children}</label>; }
function ApplicationFields({ value, onChange }: { value: { storeName: string; contactName: string; phone: string; taxId: string }; onChange: (value: { storeName: string; contactName: string; phone: string; taxId: string }) => void }) {
  const update = (key: keyof typeof value, next: string) => onChange({ ...value, [key]: next });
  return <><Field label="店家／公司名稱"><input required value={value.storeName} onChange={e => update('storeName', e.target.value)} className="field"/></Field><div className="grid grid-cols-2 gap-3"><Field label="聯絡人"><input required value={value.contactName} onChange={e => update('contactName', e.target.value)} className="field"/></Field><Field label="電話"><input required value={value.phone} onChange={e => update('phone', e.target.value)} className="field"/></Field></div><Field label="統一編號（選填）"><input value={value.taxId} onChange={e => update('taxId', e.target.value)} className="field"/></Field></>;
}
