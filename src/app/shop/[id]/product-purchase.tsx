"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Check, ShoppingBag } from 'lucide-react';
import type { PhysicalProduct } from '@/lib/physical-store';

const CART_KEY = 'firstroamlink-physical-cart-v1';

export default function ProductPurchase({ product }: { product: PhysicalProduct }) {
  const [added, setAdded] = useState(false);
  const add = () => {
    let cart: Array<PhysicalProduct & { quantity: number }> = [];
    try { const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); if (Array.isArray(parsed)) cart = parsed; } catch {}
    const existing = cart.find(item => item.id === product.id);
    const next = existing
      ? cart.map(item => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock_quantity) } : item)
      : [...cart, { ...product, quantity: 1 }];
    localStorage.setItem(CART_KEY, JSON.stringify(next));
    setAdded(true);
  };
  return <div className="mt-7 border-y border-black/10 py-6"><div className="flex items-end justify-between gap-4"><div><p className="text-xs text-black/35">售價／租金</p><p className="mt-1 text-3xl font-bold text-[#df4d5f]"><span className="mr-1 text-sm">NT$</span>{product.price.toLocaleString()}</p></div><p className={`text-sm ${product.stock_quantity > 0 ? 'text-[#247253]' : 'text-[#df4d5f]'}`}>{product.stock_quantity > 0 ? `現貨 ${product.stock_quantity} 件` : '目前無庫存'}</p></div><button onClick={add} disabled={product.stock_quantity <= 0} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#172028] font-bold text-white hover:bg-[#283541] disabled:bg-black/10 disabled:text-black/30">{added ? <><Check size={19} /> 已加入購物車</> : <><ShoppingBag size={19} /> 加入購物車</>}</button>{added && <Link href="/shop" className="mt-3 block text-center text-sm font-semibold text-[#247253] hover:underline">返回商城開啟購物車</Link>}</div>;
}
