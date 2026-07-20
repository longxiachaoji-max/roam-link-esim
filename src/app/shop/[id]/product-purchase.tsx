"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Check, ShoppingBag } from 'lucide-react';
import type { PhysicalProduct } from '@/lib/physical-store';
import { calculateRentalPrice } from '@/lib/rental-pricing';
import RentalDatePicker, { type RentalSelection } from './rental-date-picker';

const CART_KEY = 'firstroamlink-physical-cart-v1';

export default function ProductPurchase({ product }: { product: PhysicalProduct }) {
  const [added, setAdded] = useState(false);
  const [rentalSelection, setRentalSelection] = useState<RentalSelection | null>(null);
  const isRental = product.category === 'rental';
  const rentalTotal = calculateRentalPrice(product.price, rentalSelection?.days || 1, product.rental_price_tiers);

  const add = () => {
    if (isRental && !rentalSelection) return;
    type StoredCartItem = PhysicalProduct & {
      quantity: number;
      rentalStartDate?: string;
      rentalEndDate?: string;
      rentalDays?: number;
    };
    let cart: StoredCartItem[] = [];
    try { const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); if (Array.isArray(parsed)) cart = parsed; } catch {}
    const rentalFields = rentalSelection ? {
      rentalStartDate: rentalSelection.startDate,
      rentalEndDate: rentalSelection.endDate,
      rentalDays: rentalSelection.days
    } : {};
    const existing = cart.find(item => item.id === product.id);
    const next = existing
      ? isRental
        ? cart.map(item => item.id === product.id ? { ...item, ...rentalFields, quantity: 1 } : item)
        : cart.map(item => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock_quantity) } : item)
      : [...cart, { ...product, ...rentalFields, quantity: 1 }];
    localStorage.setItem(CART_KEY, JSON.stringify(next));
    setAdded(true);
  };
  return <div className="mt-7 border-y border-black/10 py-6">
    <div className="flex items-end justify-between gap-4">
      <div><p className="text-xs text-black/35">{isRental ? '每日租金' : '售價'}</p><p className="mt-1 text-3xl font-bold text-[#df4d5f]"><span className="mr-1 text-sm">NT$</span>{product.price.toLocaleString()}{isRental && <span className="ml-1 text-sm font-medium text-black/35">／天</span>}</p></div>
      <p className={`text-sm ${product.stock_quantity > 0 ? 'text-[#247253]' : 'text-[#df4d5f]'}`}>{product.stock_quantity > 0 ? isRental ? `可租借 ${product.stock_quantity} 組` : `現貨 ${product.stock_quantity} 件` : isRental ? '目前無可租借庫存' : '目前無庫存'}</p>
    </div>
    {isRental && product.stock_quantity > 0 && <RentalDatePicker productId={product.id} onChange={selection => { setRentalSelection(selection); setAdded(false); }} />}
    {isRental && rentalSelection && <div className="mt-4 flex items-center justify-between rounded-md bg-[#dceee7] px-4 py-3"><div><p className="text-xs text-black/45">{rentalSelection.days} 天租金總額</p><p className="mt-1 text-xs text-black/40">{product.rental_price_tiers.some(tier => tier.days === rentalSelection.days) ? '已套用租期優惠' : `每日 NT$${product.price.toLocaleString()}`}</p></div><p className="text-2xl font-bold text-[#df4d5f]">NT${rentalTotal.toLocaleString()}</p></div>}
    <button onClick={add} disabled={product.stock_quantity <= 0 || (isRental && !rentalSelection)} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#172028] font-bold text-white hover:bg-[#283541] disabled:bg-black/10 disabled:text-black/30">{added ? <><Check size={19} /> 已加入購物車</> : <><ShoppingBag size={19} /> {isRental && !rentalSelection ? '選好租借日期後加入' : '加入購物車'}</>}</button>
    {added && <Link href="/shop" className="mt-3 block text-center text-sm font-semibold text-[#247253] hover:underline">返回商城開啟購物車</Link>}
  </div>;
}
