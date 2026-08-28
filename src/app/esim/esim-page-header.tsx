'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingBag, ShoppingCart } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ESIM_CART_STORAGE_KEY, ESIM_CART_UPDATED_EVENT, readEsimCart } from '@/lib/esim-cart';

export default function EsimPageHeader({ fallbackHref = '/esim' }: { fallbackHref?: string }) {
  const router = useRouter();
  const [cartCount, setCartCount] = useState(0);

  const refreshCartCount = useCallback(() => setCartCount(readEsimCart().length), []);

  useEffect(() => {
    const timer = window.setTimeout(refreshCartCount, 0);
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === ESIM_CART_STORAGE_KEY) refreshCartCount();
    };
    window.addEventListener(ESIM_CART_UPDATED_EVENT, refreshCartCount);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('pageshow', refreshCartCount);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(ESIM_CART_UPDATED_EVENT, refreshCartCount);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pageshow', refreshCartCount);
    };
  }, [refreshCartCount]);

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(fallbackHref);
  };

  return <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0D0D1A]/95 backdrop-blur-md">
    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-3 md:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button type="button" onClick={goBack} aria-label="返回上一頁" title="返回上一頁" className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/10 text-white/65 hover:bg-white/5 hover:text-white">
          <ArrowLeft size={19} />
        </button>
        <Link href="/" className="min-w-0 font-bold leading-tight">
          <span className="block truncate text-[11px] text-white/55 sm:text-xs">一飛通全球漫遊</span>
          <span className="block truncate text-sm text-[#ff6b73] sm:text-base">FirstRoamLink</span>
        </Link>
      </div>
      <nav className="flex shrink-0 items-center gap-2">
        <Link href="/shop" aria-label="一飛通商城" title="一飛通商城" className="grid h-10 w-10 place-items-center rounded-md text-white/55 hover:bg-white/5 hover:text-white"><ShoppingBag size={18} /></Link>
        <Link href="/?cart=open" aria-label={`開啟購物車，目前 ${cartCount} 件`} className="relative inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#ff5a69] px-2.5 font-bold text-white hover:bg-[#ff7180] sm:px-3">
          <ShoppingCart size={18} />
          <span className="hidden text-xs sm:inline">購物車</span>
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#f5bd61] px-1 text-[11px] font-black text-[#17131a]" aria-hidden="true">{cartCount}</span>
        </Link>
      </nav>
    </div>
  </header>;
}
