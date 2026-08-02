"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Check, ShoppingBag } from 'lucide-react';
import type { PhysicalProduct } from '@/lib/physical-store';
import {
  mergePhysicalCartSnapshots,
  normalizePhysicalCartSnapshot,
  PHYSICAL_CART_OWNER_KEY,
  readPhysicalCartSnapshot,
  writePhysicalCartSnapshot
} from '@/lib/physical-cart';
import { calculateRentalPrice } from '@/lib/rental-pricing';
import { supabase } from '@/lib/supabase';
import RentalDatePicker, { type RentalSelection } from './rental-date-picker';

export default function ProductPurchase({ product }: { product: PhysicalProduct }) {
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [rentalSelection, setRentalSelection] = useState<RentalSelection | null>(null);
  const isRental = product.category === 'rental';
  const rentalTotal = calculateRentalPrice(product.price, rentalSelection?.days || 1, product.rental_price_tiers);
  const rentalOriginalTotal = product.price * (rentalSelection?.days || 1);
  const hasRentalDiscount = rentalTotal < rentalOriginalTotal;

  const add = async () => {
    if (isRental && !rentalSelection) return;
    setAdding(true);
    setSyncError('');
    try {
    const localItems = readPhysicalCartSnapshot();
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    let baseItems = localItems;

    if (session?.access_token) {
      try {
        const response = await fetch('/api/member/cart', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '讀取會員購物車失敗');
        const cloudItems = normalizePhysicalCartSnapshot(result.items);
        baseItems = localStorage.getItem(PHYSICAL_CART_OWNER_KEY) === session.user.id
          ? cloudItems
          : mergePhysicalCartSnapshots(cloudItems, localItems);
      } catch {
        localStorage.removeItem(PHYSICAL_CART_OWNER_KEY);
      }
    }

    const withoutCurrentRental = isRental
      ? baseItems.filter(item => item.productId !== product.id)
      : baseItems;
    const existingIndex = withoutCurrentRental.findIndex(item =>
      item.productId === product.id && !item.rentalStartDate);
    const nextItems = [...withoutCurrentRental];
    if (isRental && rentalSelection) {
      nextItems.push({
        productId: product.id,
        quantity: 1,
        rentalStartDate: rentalSelection.startDate,
        rentalEndDate: rentalSelection.endDate
      });
    } else if (existingIndex >= 0) {
      nextItems[existingIndex] = {
        ...nextItems[existingIndex],
        quantity: Math.min(nextItems[existingIndex].quantity + 1, product.stock_quantity)
      };
    } else {
      nextItems.push({ productId: product.id, quantity: 1 });
    }

    const normalizedItems = normalizePhysicalCartSnapshot(nextItems);
    writePhysicalCartSnapshot(normalizedItems);

    if (session?.access_token) {
      try {
        const response = await fetch('/api/member/cart', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ items: normalizedItems })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '儲存會員購物車失敗');
        localStorage.setItem(PHYSICAL_CART_OWNER_KEY, session.user.id);
      } catch {
        localStorage.removeItem(PHYSICAL_CART_OWNER_KEY);
        setSyncError('已先保存在這個裝置，雲端同步稍後再試');
      }
    }

    setAdded(true);
    } catch {
      setSyncError('加入購物車失敗，請再試一次');
    } finally {
      setAdding(false);
    }
  };
  return <div className="mt-7 border-y border-black/10 py-6">
    <div className="flex items-end justify-between gap-4">
      <div><p className="text-xs text-black/35">{isRental ? '每日租金' : '售價'}</p><p className="mt-1 text-3xl font-bold text-[#df4d5f]"><span className="mr-1 text-sm">NT$</span>{product.price.toLocaleString()}{isRental && <span className="ml-1 text-sm font-medium text-black/35">／天</span>}</p></div>
      <p className={`text-sm ${product.stock_quantity > 0 ? 'text-[#247253]' : 'text-[#df4d5f]'}`}>{product.stock_quantity > 0 ? isRental ? `可租借 ${product.stock_quantity} 組` : `現貨 ${product.stock_quantity} 件` : isRental ? '目前無可租借庫存' : '目前無庫存'}</p>
    </div>
    {isRental && product.stock_quantity > 0 && <>
      <RentalDatePicker productId={product.id} onChange={selection => { setRentalSelection(selection); setAdded(false); }} />
      <div className="mt-4 rounded-md border border-[#06c755]/25 bg-[#eafaf0] px-4 py-4">
        <p className="text-sm leading-6 text-[#174d38]">如需面交，請先聯繫客服預約時間後再下單。</p>
        <a
          href="https://lin.ee/Td0EgHE"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="加入一飛通 LINE 好友"
          className="mt-3 inline-flex min-h-11 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#06c755]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- LINE serves the official localized button. */}
          <img
            src="https://scdn.line-apps.com/n/line_add_friends/btn/zh-Hant.png"
            alt="加入 LINE 好友"
            width="116"
            height="36"
            className="h-9 w-auto"
          />
        </a>
      </div>
    </>}
    {isRental && rentalSelection && <div className="mt-4 flex items-end justify-between gap-4 rounded-md bg-[#dceee7] px-4 py-3"><div><p className="text-xs text-black/45">{rentalSelection.days} 天租金總額</p><p className="mt-1 text-xs text-black/40">{hasRentalDiscount ? '優惠後結帳價' : `每日 NT$${product.price.toLocaleString()}`}</p></div><div className="shrink-0 text-right">{hasRentalDiscount && <p className="text-sm text-black/40 line-through">NT${rentalOriginalTotal.toLocaleString()}</p>}<p className="mt-0.5 text-2xl font-bold text-[#df4d5f]">NT${rentalTotal.toLocaleString()}</p></div></div>}
    <button onClick={add} disabled={adding || product.stock_quantity <= 0 || (isRental && !rentalSelection)} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#172028] font-bold text-white hover:bg-[#283541] disabled:bg-black/10 disabled:text-black/30">{added ? <><Check size={19} /> 已加入購物車</> : <><ShoppingBag size={19} /> {adding ? '同步購物車中...' : isRental && !rentalSelection ? '選好租借日期後加入' : '加入購物車'}</>}</button>
    {syncError && <p className="mt-2 text-center text-xs text-[#c43b4e]">{syncError}</p>}
    {added && <Link href="/shop" className="mt-3 block text-center text-sm font-semibold text-[#247253] hover:underline">返回商城開啟購物車</Link>}
  </div>;
}
