"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Barcode, CalendarDays, CreditCard, LogIn, Minus, Package, Plus, ShoppingBag, Trash2, User, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Category = 'all' | 'rental' | 'travel_card' | 'other';
interface Product { id: string; name: string; category: Exclude<Category, 'all'>; summary: string | null; price: number; stock_quantity: number; images: string[]; }
interface CartItem extends Product {
  quantity: number;
  rentalStartDate?: string;
  rentalEndDate?: string;
  rentalDays?: number;
}

const CART_KEY = 'firstroamlink-physical-cart-v1';
const CATEGORY_LABELS: Record<Category, string> = { all: '全部商品', rental: '商品租借', travel_card: '實體漫遊卡', other: '其他旅遊商品' };

function cartItemKey(item: CartItem) {
  return item.category === 'rental' ? `${item.id}:${item.rentalStartDate}:${item.rentalEndDate}` : item.id;
}

function lineTotal(item: CartItem) {
  return item.price * item.quantity * (item.category === 'rental' ? item.rentalDays || 0 : 1);
}

function formatRentalDate(value?: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' }).format(new Date(year, month - 1, day));
}

export default function PhysicalShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sessionEmail, setSessionEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [paying, setPaying] = useState<'Credit' | 'BARCODE' | null>(null);
  const [shipping, setShipping] = useState({ recipientName: '', recipientPhone: '', postalCode: '', shippingAddress: '', shippingNote: '' });

  useEffect(() => {
    fetch('/api/shop/products').then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '商品載入失敗');
      setProducts(result.products || []);
    }).catch(error => setMessage(error.message)).finally(() => setLoading(false));

    queueMicrotask(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
        if (Array.isArray(saved)) setCart(saved.filter((item: CartItem) => item.category !== 'rental'
          || (item.rentalStartDate && item.rentalEndDate && Number(item.rentalDays) > 0)));
      } catch { localStorage.removeItem(CART_KEY); }
      setCartReady(true);

      const payment = new URLSearchParams(window.location.search).get('payment');
      if (payment === 'success') {
        localStorage.removeItem(CART_KEY);
        setCart([]);
        setMessage('付款完成，訂單已成立，我們會開始備貨。');
      } else if (payment === 'barcode') setMessage('超商條碼已建立，完成繳費後訂單會自動更新。');
      else if (payment === 'cancelled') setMessage('付款尚未完成，購物車已為你保留。');
      else if (payment === 'failed') setMessage('付款未完成，請再試一次。');
      if (payment) window.history.replaceState({}, '', '/shop');
    });

    supabase.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email || ''));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSessionEmail(session?.user.email || ''));

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    if (cart.length) localStorage.setItem(CART_KEY, JSON.stringify(cart));
    else localStorage.removeItem(CART_KEY);
  }, [cart, cartReady]);

  useEffect(() => {
    const resetPayment = () => setPaying(null);
    window.addEventListener('pageshow', resetPayment);
    document.addEventListener('visibilitychange', resetPayment);
    return () => { window.removeEventListener('pageshow', resetPayment); document.removeEventListener('visibilitychange', resetPayment); };
  }, []);

  const filtered = category === 'all' ? products : products.filter(product => product.category === category);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + lineTotal(item), 0);

  const addToCart = (product: Product) => {
    if (product.category === 'rental') return;
    setCart(current => {
      const existing = current.find(item => item.id === product.id);
      if (existing) return current.map(item => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock_quantity) } : item);
      return [...current, { ...product, quantity: 1 }];
    });
    setMessage(`已加入：${product.name}`);
  };

  const setQuantity = (key: string, quantity: number) => setCart(current => current
    .map(item => cartItemKey(item) === key ? { ...item, quantity: item.category === 'rental' ? 1 : Math.min(Math.max(quantity, 0), item.stock_quantity) } : item)
    .filter(item => item.quantity > 0));

  const openCheckout = () => {
    if (!sessionEmail) { setCartOpen(false); setLoginOpen(true); setMessage('請先登入會員再結帳'); return; }
    setCartOpen(false); setCheckoutOpen(true);
  };

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMessage(`登入失敗：${error.message}`);
    setLoginOpen(false); setCheckoutOpen(true); setMessage('登入成功');
  };

  const checkout = async (paymentMethod: 'Credit' | 'BARCODE') => {
    if (paying || !cart.length) return;
    setPaying(paymentMethod);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error('登入狀態已過期，請重新登入');
      const response = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.id,
            quantity: item.quantity,
            rentalStartDate: item.rentalStartDate,
            rentalEndDate: item.rentalEndDate
          })),
          paymentMethod,
          ...shipping
        })
      });
      const result = await response.json();
      if (!response.ok || !result.action || !result.fields) throw new Error(result.error || '無法建立付款');
      const form = document.createElement('form');
      form.method = 'POST'; form.action = result.action; form.style.display = 'none';
      Object.entries(result.fields as Record<string, string>).forEach(([name, value]) => {
        const input = document.createElement('input'); input.name = name; input.value = value; form.appendChild(input);
      });
      document.body.appendChild(form); form.submit();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '結帳失敗');
      setPaying(null);
    }
  };

  return (
    <main className="relative min-h-screen bg-[#f5f7f8] text-[#172028]">
      <header className="sticky top-0 z-40 border-b border-black/8 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link href="/shop" className="min-w-0 font-bold leading-tight tracking-normal">
            <span className="block text-xs text-black/55 sm:text-sm">一飛通全球漫遊</span>
            <span className="block text-base text-[#df4d5f] sm:text-lg">FirstRoamLink</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/" className="hidden rounded-md px-3 py-2 text-sm text-black/55 hover:bg-black/5 sm:block">eSIM 方案</Link>
            <Link href="/member" title="會員中心" className="grid h-10 w-10 place-items-center rounded-md text-black/55 hover:bg-black/5"><User size={19} /></Link>
            <button title="購物車" onClick={() => setCartOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-md bg-[#172028] text-white hover:bg-[#283541]">
              <ShoppingBag size={19} />{count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#df4d5f] px-1 text-[11px] font-bold">{count}</span>}
            </button>
          </nav>
        </div>
      </header>

      <section className="border-b border-black/8 bg-[#dceee7]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-4 py-10 md:flex-row md:items-end md:px-6">
          <div><p className="mb-2 text-sm font-semibold text-[#247253]">一飛通全球漫遊 FirstRoamLink</p><h1 className="text-3xl font-bold md:text-4xl">一飛通商城</h1><p className="mt-3 max-w-xl text-sm leading-6 text-black/55">實體漫遊卡、旅行租借與出國用品，付款完成後由專人安排出貨或租借。</p></div>
          <div className="flex items-center gap-2 text-sm text-black/50"><Package size={18} /> 台灣寄送 · 訂單進度由後台處理</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {message && <div className="mb-6 flex items-center justify-between rounded-md border border-[#247253]/20 bg-white px-4 py-3 text-sm text-[#245743]"><span>{message}</span><button title="關閉訊息" onClick={() => setMessage('')}><X size={16} /></button></div>}
        <div className="mb-7 flex gap-2 overflow-x-auto pb-1">
          {(Object.keys(CATEGORY_LABELS) as Category[]).map(value => <button key={value} onClick={() => setCategory(value)} className={`h-10 shrink-0 rounded-md px-4 text-sm font-semibold ${category === value ? 'bg-[#172028] text-white' : 'border border-black/10 bg-white text-black/55 hover:border-black/25'}`}>{CATEGORY_LABELS[value]}</button>)}
        </div>

        {loading ? <div className="py-24 text-center text-black/40">商品載入中...</div> : filtered.length === 0 ? <div className="border-y border-black/8 py-24 text-center"><Package className="mx-auto mb-3 text-black/20" size={40} /><p className="font-semibold">這個分類目前尚未上架商品</p><p className="mt-2 text-sm text-black/45">商品準備完成後會顯示在這裡</p></div> : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(product => <article key={product.id} className="overflow-hidden rounded-md border border-black/8 bg-white shadow-[0_8px_24px_rgba(17,30,38,0.06)]">
              <Link href={`/shop/${product.id}`} className="relative block aspect-[4/3] overflow-hidden bg-[#edf0f1]">
                {product.images[0] ? <Image src={product.images[0]} alt={product.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover transition-transform duration-300 hover:scale-[1.03]" /> : <div className="grid h-full place-items-center"><Package size={38} className="text-black/15" /></div>}
              </Link>
              <div className="p-4"><p className="mb-2 text-xs font-semibold text-[#247253]">{CATEGORY_LABELS[product.category]}</p><Link href={`/shop/${product.id}`} className="line-clamp-2 min-h-12 font-semibold leading-6 hover:text-[#df4d5f]">{product.name}</Link><p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-black/45">{product.summary || '查看完整商品規格與使用說明'}</p>
                <div className="mt-5 flex items-center justify-between"><div><span className="text-xs text-black/35">NT$</span><span className="ml-1 text-xl font-bold text-[#df4d5f]">{product.price.toLocaleString()}</span>{product.category === 'rental' && <span className="ml-1 text-xs text-black/35">／天</span>}</div>{product.category === 'rental' ? <Link title="選擇租借日期" href={`/shop/${product.id}`} className="grid h-11 w-11 place-items-center rounded-md bg-[#247253] text-white hover:bg-[#185e42]"><CalendarDays size={20} /></Link> : <button title="加入購物車" onClick={() => addToCart(product)} disabled={product.stock_quantity <= 0} className="grid h-11 w-11 place-items-center rounded-md bg-[#df4d5f] text-white hover:bg-[#c93e51] disabled:bg-black/10 disabled:text-black/30"><Plus size={21} /></button>}</div>
                <p className={`mt-3 text-xs ${product.stock_quantity > 0 ? 'text-black/35' : 'text-[#df4d5f]'}`}>{product.stock_quantity > 0 ? product.category === 'rental' ? `可租借 ${product.stock_quantity} 組 · 選日期` : `現貨 ${product.stock_quantity} 件` : product.category === 'rental' ? '目前無可租借庫存' : '目前無庫存'}</p>
              </div>
            </article>)}
          </div>
        )}
      </section>

      <footer className="mt-12 border-t border-black/8 bg-white"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-6 py-7 text-sm text-black/45 sm:flex-row"><span>一飛通全球漫遊 FirstRoamLink</span><a href="mailto:roamlinktw@gmail.com" className="hover:text-black">roamlinktw@gmail.com</a></div></footer>

      {cartOpen && <div className="fixed inset-0 z-50 flex justify-end bg-black/45" onMouseDown={e => e.target === e.currentTarget && setCartOpen(false)}><aside className="flex h-full w-full max-w-md flex-col bg-white text-[#172028] shadow-2xl">
        <div className="flex h-16 items-center justify-between border-b border-black/8 px-5"><h2 className="font-bold">購物車 ({count})</h2><button title="關閉" onClick={() => setCartOpen(false)} className="grid h-9 w-9 place-items-center rounded-md hover:bg-black/5"><X size={20} /></button></div>
        <div className="flex-1 overflow-y-auto p-5">{cart.length === 0 ? <div className="pt-24 text-center text-black/40"><ShoppingBag className="mx-auto mb-3" size={36} />購物車目前是空的</div> : <div className="space-y-5">{cart.map(item => { const key = cartItemKey(item); return <div key={key} className="flex gap-3 border-b border-black/8 pb-5"><div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-black/5">{item.images[0] && <Image src={item.images[0]} alt="" fill sizes="80px" className="object-cover" />}</div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold">{item.name}</p>{item.category === 'rental' && <p className="mt-1 text-xs font-semibold text-[#247253]"><CalendarDays className="mr-1 inline" size={13} />{formatRentalDate(item.rentalStartDate)} 至 {formatRentalDate(item.rentalEndDate)} · {item.rentalDays} 天</p>}<p className="mt-1 font-mono text-sm text-[#df4d5f]">NT${lineTotal(item).toLocaleString()}</p><div className="mt-3 flex items-center gap-2">{item.category === 'rental' ? <span className="text-xs text-black/40">租借數量 1</span> : <><button title="減少數量" onClick={() => setQuantity(key, item.quantity - 1)} className="grid h-7 w-7 place-items-center rounded border border-black/10"><Minus size={13} /></button><span className="w-6 text-center text-sm">{item.quantity}</span><button title="增加數量" onClick={() => setQuantity(key, item.quantity + 1)} className="grid h-7 w-7 place-items-center rounded border border-black/10"><Plus size={13} /></button></>}<button title="移除商品" onClick={() => setQuantity(key, 0)} className="ml-auto text-black/35 hover:text-[#df4d5f]"><Trash2 size={16} /></button></div></div></div>; })}</div>}</div>
        {cart.length > 0 && <div className="border-t border-black/8 p-5"><div className="mb-4 flex justify-between"><span className="text-black/50">商品合計</span><span className="text-xl font-bold">NT${total.toLocaleString()}</span></div><button onClick={openCheckout} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#172028] font-bold text-white hover:bg-[#283541]">填寫收件資料 <ArrowRight size={17} /></button></div>}
      </aside></div>}

      {loginOpen && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4"><form onSubmit={login} className="w-full max-w-sm rounded-md bg-white p-6 text-[#172028] shadow-2xl"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-bold">會員登入</h2><button type="button" title="關閉" onClick={() => setLoginOpen(false)}><X size={20} /></button></div><label className="block text-sm text-black/55">Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-black/12 px-3 outline-none focus:border-[#247253]" /></label><label className="mt-4 block text-sm text-black/55">密碼<input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-black/12 px-3 outline-none focus:border-[#247253]" /></label><button className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#172028] font-bold text-white"><LogIn size={17} /> 登入並繼續結帳</button><p className="mt-4 text-center text-xs text-black/40">尚未註冊可先回 eSIM 首頁建立會員帳號</p></form></div>}

      {checkoutOpen && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-md bg-white p-5 text-[#172028] shadow-2xl sm:rounded-md sm:p-7"><div className="mb-6 flex items-center justify-between"><div><h2 className="text-xl font-bold">收件與付款</h2><p className="mt-1 text-xs text-black/40">登入會員：{sessionEmail}</p></div><button title="關閉" onClick={() => setCheckoutOpen(false)}><X size={20} /></button></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-black/55">收件人姓名<input required value={shipping.recipientName} onChange={e => setShipping({ ...shipping, recipientName: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-black/12 px-3 outline-none focus:border-[#247253]" /></label><label className="text-sm text-black/55">聯絡電話<input required inputMode="tel" value={shipping.recipientPhone} onChange={e => setShipping({ ...shipping, recipientPhone: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-black/12 px-3 outline-none focus:border-[#247253]" /></label><label className="text-sm text-black/55">郵遞區號<input inputMode="numeric" value={shipping.postalCode} onChange={e => setShipping({ ...shipping, postalCode: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-black/12 px-3 outline-none focus:border-[#247253]" /></label><label className="text-sm text-black/55 sm:col-span-2">收件地址<input required value={shipping.shippingAddress} onChange={e => setShipping({ ...shipping, shippingAddress: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-black/12 px-3 outline-none focus:border-[#247253]" /></label><label className="text-sm text-black/55 sm:col-span-2">訂單備註<textarea rows={3} value={shipping.shippingNote} onChange={e => setShipping({ ...shipping, shippingNote: e.target.value })} className="mt-2 w-full rounded-md border border-black/12 p-3 outline-none focus:border-[#247253]" /></label></div><div className="my-6 flex items-center justify-between border-y border-black/8 py-4"><div><p className="text-sm text-black/45">本次付款</p><p className="text-xs text-[#247253]">目前免運費</p></div><p className="text-2xl font-bold text-[#df4d5f]">NT${total.toLocaleString()}</p></div><div className="grid gap-3 sm:grid-cols-2"><button onClick={() => checkout('Credit')} disabled={paying !== null} className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#172028] font-bold text-white disabled:opacity-40"><CreditCard size={18} /> {paying === 'Credit' ? '前往付款中...' : '信用卡付款'}</button><button onClick={() => checkout('BARCODE')} disabled={paying !== null} className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#247253] font-bold text-white disabled:opacity-40"><Barcode size={18} /> {paying === 'BARCODE' ? '產生條碼中...' : '超商條碼付款'}</button></div></div></div>}
    </main>
  );
}
