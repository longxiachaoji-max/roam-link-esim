"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, MessageSquareText, RefreshCw, Search, Star } from 'lucide-react';
import { adminFetch } from '@/lib/admin-fetch';

type Relation<T> = T | T[] | null;

interface Review {
  id: string;
  review_type: 'esim' | 'physical';
  rating: number;
  smoothness_rating: number | null;
  comment: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  customers: Relation<{ email: string; name: string | null }>;
  products: Relation<{ id: string; name: string; country: string; data_amount: string | null; validity_days: number }>;
  orders: Relation<{ id: string; order_number: string | null }>;
  physical_products: Relation<{ id: string; name: string; category: string }>;
  physical_orders: Relation<{ id: string }>;
}

function relation<T>(value: Relation<T>) {
  return Array.isArray(value) ? value[0] || null : value;
}

const PHYSICAL_CATEGORY_LABELS: Record<string, string> = {
  rental: '商品租借',
  travel_card: '實體漫遊卡',
  other: '其他旅遊商品'
};

function reviewProduct(review: Review) {
  if (review.review_type === 'physical') {
    const product = relation(review.physical_products);
    return {
      name: product?.name || '已下架商品',
      country: '實體商品',
      detail: product ? PHYSICAL_CATEGORY_LABELS[product.category] || product.category : '-'
    };
  }
  const product = relation(review.products);
  return {
    name: product?.name || '已下架商品',
    country: product?.country || '-',
    detail: product ? `${product.validity_days} 天${product.data_amount ? ` · ${product.data_amount}` : ''}` : '-'
  };
}

function reviewOrder(review: Review) {
  if (review.review_type === 'physical') {
    const order = relation(review.physical_orders);
    return { id: order?.id || '', orderNumber: null };
  }
  const order = relation(review.orders);
  return { id: order?.id || '', orderNumber: order?.order_number || null };
}

function Stars({ value }: { value: number }) {
  return <span className="inline-flex gap-0.5 text-amber-300" aria-label={`${value} 星`}>
    {[1, 2, 3, 4, 5].map(star => <Star key={star} size={15} fill={star <= value ? 'currentColor' : 'none'} className={star <= value ? '' : 'text-white/20'} />)}
  </span>;
}

export default function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('全部');
  const [rating, setRating] = useState('全部');

  const loadReviews = useCallback(async () => {
    setLoading(true);
    const response = await adminFetch('/api/admin/reviews', { cache: 'no-store' });
    const result = await response.json();
    if (response.ok) setReviews(result.reviews || []);
    else setMessage(result.error || '評論載入失敗');
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReviews(), 0);
    return () => window.clearTimeout(timer);
  }, [loadReviews]);

  const countries = useMemo(() => [...new Set(reviews.map(review => reviewProduct(review).country).filter(Boolean))].sort(), [reviews]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return reviews.filter(review => {
      const product = reviewProduct(review);
      const customer = relation(review.customers);
      const order = reviewOrder(review);
      if (country !== '全部' && product.country !== country) return false;
      if (rating !== '全部' && review.rating !== Number(rating)) return false;
      if (!normalizedQuery) return true;
      return [review.comment, product.name, product.detail, customer?.email, customer?.name, order.orderNumber, order.id]
        .some(value => String(value || '').toLowerCase().includes(normalizedQuery));
    });
  }, [country, query, rating, reviews]);

  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const smoothnessReviews = reviews.filter(review => review.review_type === 'esim' && review.smoothness_rating !== null);
  const averageSmoothness = smoothnessReviews.length ? smoothnessReviews.reduce((sum, review) => sum + Number(review.smoothness_rating), 0) / smoothnessReviews.length : 0;

  const toggleVisibility = async (review: Review) => {
    setSavingId(review.id);
    const response = await adminFetch('/api/admin/reviews', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: review.id, reviewType: review.review_type, isVisible: !review.is_visible })
    });
    const result = await response.json();
    if (response.ok) {
      setReviews(current => current.map(item => item.id === review.id && item.review_type === review.review_type ? { ...item, is_visible: !item.is_visible } : item));
      setMessage(review.is_visible ? '評論已從前台隱藏' : '評論已重新公開');
    } else {
      setMessage(result.error || '更新失敗');
    }
    setSavingId(null);
  };

  return <div className="mx-auto max-w-7xl pb-20">
    <div className="mb-7 flex items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold text-white">商品評論</h1><p className="mt-1 text-sm text-white/45">查看 eSIM 與實體商品已購買會員留下的真實評價</p></div>
      <button type="button" onClick={() => void loadReviews()} disabled={loading} title="重新整理" className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-white/55 hover:bg-white/5 disabled:opacity-40"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
    </div>

    {message && <div className="mb-5 rounded-md border border-cyan-400/20 bg-cyan-400/8 px-4 py-3 text-sm text-cyan-100">{message}</div>}

    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <div className="rounded-md border border-white/10 bg-[#141426] p-4"><p className="text-xs text-white/40">評論總數</p><p className="mt-2 text-2xl font-black">{reviews.length}</p></div>
      <div className="rounded-md border border-white/10 bg-[#141426] p-4"><p className="text-xs text-white/40">平均星級</p><p className="mt-2 text-2xl font-black text-amber-300">{average.toFixed(1)} / 5</p></div>
      <div className="rounded-md border border-white/10 bg-[#141426] p-4"><p className="text-xs text-white/40">平均順暢度</p><p className="mt-2 text-2xl font-black text-cyan-300">{averageSmoothness.toFixed(1)} / 5</p></div>
    </div>

    <div className="mb-5 grid gap-3 rounded-md border border-white/10 bg-[#141426] p-4 md:grid-cols-[minmax(240px,1fr)_180px_160px]">
      <label className="relative"><Search className="absolute left-3 top-3 text-white/30" size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜尋商品、會員、訂單或留言" className="h-10 w-full rounded-md border border-white/10 bg-[#0d0d1a] pl-10 pr-3 text-sm text-white outline-none focus:border-cyan-400/40" /></label>
      <select value={country} onChange={event => setCountry(event.target.value)} className="h-10 rounded-md border border-white/10 bg-[#0d0d1a] px-3 text-sm text-white"><option>全部</option>{countries.map(item => <option key={item}>{item}</option>)}</select>
      <select value={rating} onChange={event => setRating(event.target.value)} className="h-10 rounded-md border border-white/10 bg-[#0d0d1a] px-3 text-sm text-white"><option>全部</option>{[5, 4, 3, 2, 1].map(item => <option key={item} value={item}>{item} 星</option>)}</select>
    </div>

    <div className="overflow-hidden rounded-md border border-white/10 bg-[#141426]">
      {loading && reviews.length === 0 ? <div className="py-16 text-center text-white/40">評論載入中...</div> : filtered.length === 0 ? <div className="py-16 text-center text-white/40"><MessageSquareText className="mx-auto mb-3 opacity-30" size={36} />目前沒有符合條件的評論</div> : filtered.map(review => {
        const product = reviewProduct(review);
        const customer = relation(review.customers);
        const order = reviewOrder(review);
        return <article key={`${review.review_type}-${review.id}`} className={`border-b border-white/8 p-5 last:border-b-0 ${review.is_visible ? '' : 'bg-black/20 opacity-60'}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{product.name}</span><span className="rounded bg-white/5 px-2 py-1 text-xs text-white/45">{product.country}</span><span className="text-xs text-white/35">{product.detail}</span></div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><span className="flex items-center gap-2"><span className="text-white/40">整體</span><Stars value={review.rating} /></span>{review.review_type === 'esim' && review.smoothness_rating !== null && <span className="flex items-center gap-2"><span className="text-white/40">順暢度</span><Stars value={review.smoothness_rating} /></span>}</div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/75">{review.comment}</p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/35"><span>{customer?.name || '會員'} · {customer?.email || '-'}</span><span>訂單 #{order.orderNumber || order.id.slice(0, 8) || '-'}</span><span>{new Date(review.created_at).toLocaleString('zh-TW')}</span></div>
            </div>
            <button type="button" onClick={() => void toggleVisibility(review)} disabled={savingId === review.id} title={review.is_visible ? '從前台隱藏' : '重新公開'} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-sm text-white/55 hover:bg-white/5 disabled:opacity-40">{review.is_visible ? <EyeOff size={16} /> : <Eye size={16} />}{review.is_visible ? '隱藏' : '公開'}</button>
          </div>
        </article>;
      })}
    </div>
  </div>;
}
