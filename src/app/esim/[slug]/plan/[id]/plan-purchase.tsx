'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ShoppingCart, Zap } from 'lucide-react';
import { ESIM_CART_STORAGE_KEY, ESIM_CART_UPDATED_EVENT, notifyEsimCartUpdated, readEsimCart } from '@/lib/esim-cart';

interface PurchaseOption {
  id: string;
  country: string;
  dataAmount: string;
  validityDays: number;
  price: number;
  description: string;
}

interface PlanPurchaseProps {
  flag: string;
  options: PurchaseOption[];
}

export default function PlanPurchase({ flag, options }: PlanPurchaseProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(options[0]?.id || '');
  const [added, setAdded] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const selected = useMemo(
    () => options.find(option => option.id === selectedId) || options[0],
    [options, selectedId]
  );

  const refreshCounts = useCallback(() => {
    const cart = readEsimCart();
    setCartCount(cart.length);
    setSelectedCount(cart.filter(item => item.id === selectedId).length);
  }, [selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(refreshCounts, 0);
    window.addEventListener(ESIM_CART_UPDATED_EVENT, refreshCounts);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(ESIM_CART_UPDATED_EVENT, refreshCounts);
    };
  }, [refreshCounts]);

  if (!selected) return null;

  const addSelectedToCart = () => {
    const cart = readEsimCart();
    cart.push({
      id: selected.id,
      uid: Date.now() + Math.floor(Math.random() * 1000),
      country: selected.country,
      flag,
      data: selected.dataAmount,
      hotspot_sharing: '',
      days: `${selected.validityDays}天`,
      price: selected.price
    });
    window.localStorage.setItem(ESIM_CART_STORAGE_KEY, JSON.stringify(cart));
    notifyEsimCartUpdated(cart);
    setCartCount(cart.length);
    setSelectedCount(cart.filter(item => item.id === selected.id).length);
    setAdded(true);
  };

  const buyNow = () => {
    addSelectedToCart();
    router.push('/?checkout=open');
  };

  return <section className="rounded-md border border-white/10 bg-[#181826] p-5 md:p-6" aria-labelledby="purchase-heading">
    <p className="text-xs font-bold text-[#56d5ea]">選擇方案</p>
    <h2 id="purchase-heading" className="mt-2 text-xl font-bold">使用天數</h2>
    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label="選擇使用天數">
      {options.map(option => {
        const active = option.id === selected.id;
        return <button
          key={option.id}
          type="button"
          onClick={() => { setSelectedId(option.id); setAdded(false); }}
          aria-pressed={active}
          className={`h-11 rounded-md border text-sm font-bold transition-colors ${active ? 'border-[#ff5a69] bg-[#ff5a69] text-white' : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30 hover:text-white'}`}
        >
          {option.validityDays} 天
        </button>;
      })}
    </div>

    <div className="mt-6 flex items-end justify-between border-y border-white/10 py-5">
      <div><p className="text-xs text-white/40">本方案價格</p><p className="mt-1 text-sm text-white/60">{selected.validityDays} 天</p></div>
      <p><span className="mr-1 text-xs text-white/35">NT$</span><span className="text-3xl font-black text-[#f5bd61]">{selected.price.toLocaleString()}</span></p>
    </div>

    {added && <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-300"><Check size={16} />已加入購物車，目前共 {cartCount} 件</p>}
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={addSelectedToCart} className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 text-sm font-bold text-white hover:bg-white/10"><ShoppingCart size={18} />加入購物車{selectedCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#f5bd61] px-1 text-[11px] font-black text-[#17131a]">{selectedCount}</span>}</button>
      <button type="button" onClick={buyNow} className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#ff5a69] px-4 text-sm font-bold text-white hover:bg-[#ff7180]"><Zap size={18} />立即購買</button>
    </div>
    <p className="mt-4 text-xs leading-5 text-white/35">請依完整旅程選擇使用天數；抵達日與離境日是否計入，請以方案說明為準。</p>
  </section>;
}
