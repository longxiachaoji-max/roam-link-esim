'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, LogOut, Minus, Plus, RefreshCw, Search, Send, WalletCards } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

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
  dealer_order_items: Array<{ id: string; delivery_email_status: string; products: { name: string } | { name: string }[] }>;
}
interface Transaction { id: string; amount: number; balance_after: number; reason: string; created_at: string; }

const APPLICATION_KEY = 'firstroamlink-dealer-application';

function money(value: number) { return `NT$${Number(value || 0).toLocaleString('zh-TW')}`; }
function first<T>(value: T | T[]) { return Array.isArray(value) ? value[0] : value; }

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
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('全部');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [topupNote, setTopupNote] = useState('');

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
        if (result.error) throw result.error;
        if (result.data.session) {
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

  const countries = useMemo(() => ['全部', ...Array.from(new Set(products.map(item => item.country))).sort((a, b) => a.localeCompare(b, 'zh-TW'))], [products]);
  const filteredProducts = useMemo(() => products.filter(product => {
    const keyword = search.trim().toLowerCase();
    return (country === '全部' || product.country === country)
      && (!keyword || `${product.name} ${product.country} ${product.data_amount || ''}`.toLowerCase().includes(keyword));
  }), [products, search, country]);
  const cartItems = products.filter(product => cart[product.id]).map(product => ({ ...product, quantity: cart[product.id] }));
  const cartTotal = cartItems.reduce((sum, item) => sum + item.dealer_price * item.quantity, 0);

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
        <div className="mt-7 grid grid-cols-2 border-b border-white/10"><button onClick={() => setAuthMode('login')} className={`py-3 font-semibold ${authMode === 'login' ? 'border-b-2 border-[#ff4f73] text-white' : 'text-white/40'}`}>登入</button><button onClick={() => setAuthMode('register')} className={`py-3 font-semibold ${authMode === 'register' ? 'border-b-2 border-[#ff4f73] text-white' : 'text-white/40'}`}>申請帳號</button></div>
        <form onSubmit={handleAuth} className="mt-6 space-y-4">
          {authMode === 'register' && <ApplicationFields value={application} onChange={setApplication} />}
          <Field label="Email"><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="field" /></Field>
          <Field label="密碼"><input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="field" /></Field>
          <button disabled={busy} className="h-12 w-full rounded-md bg-[#ff4f73] font-black disabled:opacity-50">{busy ? '處理中...' : authMode === 'login' ? '登入經銷商專區' : '註冊並送出申請'}</button>
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
      <div className="mx-auto max-w-7xl px-4 py-7">
        {message && <div className="mb-6 border-l-2 border-[#55d5ea] bg-white/5 px-4 py-3 text-sm">{message}</div>}
        {view === 'sale' && <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <section><div className="mb-5 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-3.5 text-white/30" size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋國家或方案" className="field pl-10"/></label><select value={country} onChange={e => setCountry(e.target.value)} className="field sm:w-48">{countries.map(item => <option key={item}>{item}</option>)}</select></div><div className="divide-y divide-white/8 border-y border-white/10">{filteredProducts.map(product => <article key={product.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-semibold">{product.name}</p><p className="mt-1 text-sm text-white/40">{product.country} · {product.validity_days} 天{product.data_amount ? ` · ${product.data_amount}` : ''}</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><div className="text-right"><p className="font-black text-[#55d5ea]">{money(product.dealer_price)}</p><p className="text-xs text-white/30 line-through">售價 {money(product.retail_price)}</p></div><button onClick={() => changeQuantity(product.id, 1)} title="加入" className="grid size-10 place-items-center rounded-md bg-[#ff4f73]"><Plus size={20}/></button></div></article>)}</div></section>
          <aside className="lg:sticky lg:top-20 lg:self-start"><h2 className="text-xl font-black">本次代客訂單</h2><div className="mt-4 divide-y divide-white/8 border-y border-white/10">{cartItems.length ? cartItems.map(item => <div key={item.id} className="py-3"><p className="text-sm font-medium">{item.name}</p><div className="mt-2 flex items-center justify-between"><span className="text-[#55d5ea]">{money(item.dealer_price * item.quantity)}</span><div className="flex items-center gap-3"><button onClick={() => changeQuantity(item.id,-1)} className="p-1"><Minus size={17}/></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id,1)} className="p-1"><Plus size={17}/></button></div></div></div>) : <p className="py-7 text-sm text-white/35">尚未選擇商品</p>}</div><div className="flex justify-between py-4 text-lg font-black"><span>經銷扣款</span><span>{money(cartTotal)}</span></div><Field label="客戶 Email（安裝資料寄送至此）"><input type="email" required value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="field" placeholder="customer@example.com"/></Field><div className="mt-3"><Field label="客戶姓名（選填）"><input value={customerName} onChange={e => setCustomerName(e.target.value)} className="field"/></Field></div><button onClick={createOrder} disabled={busy || !cartItems.length || !customerEmail} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#ff4f73] font-black disabled:opacity-40"><Send size={18}/>{busy ? '建立中...' : '扣款並寄送 eSIM'}</button><p className="mt-3 text-xs leading-5 text-white/35">系統會將 QR Code 與一鍵安裝連結直接寄給客戶。客戶使用相同 Email 登入一飛通後，也可在會員中心查看。</p></aside>
        </div>}
        {view === 'orders' && <section><div className="flex items-end justify-between"><div><h2 className="text-2xl font-black">經銷訂單</h2><p className="mt-1 text-sm text-white/40">最近 50 筆代客販售</p></div><button onClick={loadOrders} title="重新整理" className="p-2 text-white/50"><RefreshCw size={19}/></button></div><div className="mt-5 divide-y divide-white/8 border-y border-white/10">{orders.length ? orders.map(order => { const normal = first(order.orders); return <article key={order.id} className="grid gap-3 py-4 md:grid-cols-[150px_1fr_150px_130px]"><div><p className="font-mono text-sm">{normal?.order_number}</p><p className="text-xs text-white/35">{new Date(order.created_at).toLocaleString('zh-TW')}</p></div><div><p>{order.customer_email}</p><p className="mt-1 text-sm text-white/40">{order.dealer_order_items.map(item => first(item.products)?.name).join('、')}</p></div><p className="font-black text-amber-300">{money(order.dealer_total)}</p><p className="text-sm text-[#55d5ea]">{order.dealer_order_items.every(item => item.delivery_email_status === 'sent') ? '已寄送安裝資料' : normal?.order_status === 'COMPLETED' ? '寄送處理中' : 'eSIM 準備中'}</p></article>}) : <p className="py-12 text-center text-white/35">尚無經銷訂單</p>}</div></section>}
        {view === 'balance' && <div className="grid gap-8 lg:grid-cols-[360px_1fr]"><section><WalletCards className="text-amber-300"/><h2 className="mt-4 text-2xl font-black">申請現金加值</h2><p className="mt-2 text-sm leading-6 text-white/45">先向一飛通完成現金付款，再送出申請。後台核准後餘額才會增加。</p><form onSubmit={requestTopup} className="mt-6 space-y-4"><Field label="申請金額"><input type="number" min="1" max="1000000" required value={topupAmount} onChange={e => setTopupAmount(e.target.value)} className="field"/></Field><Field label="付款備註（選填）"><textarea rows={3} value={topupNote} onChange={e => setTopupNote(e.target.value)} className="field py-3" placeholder="例如：現金交付日期"/></Field><button disabled={busy} className="h-12 w-full rounded-md bg-[#ff4f73] font-black">送出加值申請</button></form></section><section><h2 className="text-2xl font-black">餘額帳本</h2><div className="mt-5 divide-y divide-white/8 border-y border-white/10">{transactions.length ? transactions.map(transaction => <div key={transaction.id} className="grid grid-cols-[1fr_auto] gap-3 py-4"><div><p>{transaction.reason}</p><p className="mt-1 text-xs text-white/35">{new Date(transaction.created_at).toLocaleString('zh-TW')} · 餘額 {money(transaction.balance_after)}</p></div><p className={`font-black ${transaction.amount > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{transaction.amount > 0 ? '+' : ''}{money(transaction.amount)}</p></div>) : <p className="py-10 text-center text-white/35">尚無餘額紀錄</p>}</div></section></div>}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm text-white/50">{label}</span>{children}</label>; }
function ApplicationFields({ value, onChange }: { value: { storeName: string; contactName: string; phone: string; taxId: string }; onChange: (value: { storeName: string; contactName: string; phone: string; taxId: string }) => void }) {
  const update = (key: keyof typeof value, next: string) => onChange({ ...value, [key]: next });
  return <><Field label="店家／公司名稱"><input required value={value.storeName} onChange={e => update('storeName', e.target.value)} className="field"/></Field><div className="grid grid-cols-2 gap-3"><Field label="聯絡人"><input required value={value.contactName} onChange={e => update('contactName', e.target.value)} className="field"/></Field><Field label="電話"><input required value={value.phone} onChange={e => update('phone', e.target.value)} className="field"/></Field></div><Field label="統一編號（選填）"><input value={value.taxId} onChange={e => update('taxId', e.target.value)} className="field"/></Field></>;
}
