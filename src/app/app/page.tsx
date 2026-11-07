'use client';

// 企業 eSIM 管理 App（PWA 初版）：卡片列出所有 eSIM、一次更新用量、右上「＋」選國家→方案→張數購買、
// 點卡片選安裝方式（iPhone／Android／EasyEUICC 實體 eSIM 卡／QR Code）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Check, ChevronLeft, Copy, Plus, RefreshCw, Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { buildEasyEuiccIntentUrl, buildIosInstallUrl, buildLpaString, EASYEUICC_DOWNLOAD_URL, FIRSTROAMLINK_APP_PACKAGE, isInFirstRoamLinkApp } from '@/lib/esim-install-links';
import { LINE_SUPPORT_URL } from '@/lib/review-eligibility';

interface Usage {
  status?: string;
  usedData?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
}

interface EsimCard {
  id: string;
  orderNumber: string;
  note: string;
  planName: string;
  country: string;
  iccid: string | null;
  smdpAddress: string | null;
  activationCode: string | null;
  iosInstallUrl: string | null;
  androidInstallUrl: string | null;
  canQueryUsage: boolean;
  usage: Usage | null;
  usageCheckedAt: string | null;
  pending: boolean;
}

interface PlanOption { id: string; days: number; price: number }
interface Plan { data: string; options: PlanOption[] }
interface Destination { country: string; flag?: string; region?: string; plans: Plan[] }

type BuyStep = { step: 'country' } | { step: 'plan'; destination: Destination } | { step: 'confirm'; destination: Destination; plan: Plan; option: PlanOption };

const CHECKOUT_BATCH = 20; // 結帳 API 一次最多 20 張
const USAGE_CONCURRENCY = 4;
const AUTO_REFRESH_MS = 30 * 60_000; // 每 30 分鐘自動更新用量

const formatTime = (value: string | null) => {
  if (!value) return '尚未更新';
  return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
};

const statusClass = (status?: string) => {
  if (status === '已啟用') return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30';
  if (status === '已安裝' || status === '已下載') return 'bg-cyan-500/15 text-cyan-200 border-cyan-500/30';
  if (status === '已到期' || status === '已停用' || status === '已刪除') return 'bg-white/5 text-white/45 border-white/10';
  return 'bg-amber-500/10 text-amber-200 border-amber-500/25';
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

// 把會員訂單整理成一張張 eSIM 卡片
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCards(orders: any[]): EsimCard[] {
  return orders.flatMap(order => (order.order_items || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((item: any) => !item.user_deleted_at)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((item: any) => {
      const inventory = first(item.e_sim_inventory) as Record<string, unknown> | null;
      const product = first(item.products) as Record<string, unknown> | null;
      return {
        id: item.id,
        orderNumber: order.order_number || '',
        note: item.note || '',
        planName: String(product?.name || 'eSIM 方案'),
        country: String(product?.country || ''),
        iccid: (inventory?.iccid as string) || null,
        smdpAddress: (inventory?.smdp_address as string) || null,
        activationCode: (inventory?.activation_code as string) || null,
        iosInstallUrl: (inventory?.ios_install_url as string) || null,
        androidInstallUrl: (inventory?.android_install_url as string) || null,
        canQueryUsage: Boolean(inventory?.microesim_topup_id && inventory?.iccid),
        usage: (inventory?.microesim_usage_cache as Usage) || null,
        usageCheckedAt: (inventory?.microesim_usage_checked_at as string) || null,
        pending: !inventory
      } satisfies EsimCard;
    }));
}

function Sheet({ children, onClose, title, onBack }: { children: React.ReactNode; onClose: () => void; title: string; onBack?: () => void }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#1A1A2E] text-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3">
          {onBack && <button type="button" onClick={onBack} aria-label="上一步" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"><ChevronLeft size={20} /></button>}
          <h2 className="min-w-0 flex-1 truncate text-base font-black">{title}</h2>
          <button type="button" onClick={onClose} aria-label="關閉" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"><X size={20} /></button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export default function EsimAppPage() {
  const [authState, setAuthState] = useState<'loading' | 'out' | 'in'>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [cards, setCards] = useState<EsimCard[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingCards, setLoadingCards] = useState(false);
  const [query, setQuery] = useState('');
  const [refreshProgress, setRefreshProgress] = useState<{ done: number; total: number } | null>(null);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const cardsRef = useRef<EsimCard[]>([]);
  const refreshingAllRef = useRef(false);
  const [selected, setSelected] = useState<EsimCard | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [copied, setCopied] = useState('');
  const [toast, setToast] = useState('');
  const [buy, setBuy] = useState<BuyStep | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [countryQuery, setCountryQuery] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState<{ done: number; total: number } | null>(null);
  const [buyError, setBuyError] = useState('');
  const [inNativeApp, setInNativeApp] = useState(false);

  // 在一飛通 Android App 裡開啟時，eSIM 卡安裝交給 App 內建的讀卡機功能
  useEffect(() => {
    let remembered: string | null = null;
    try { remembered = window.sessionStorage.getItem('firstroamlink-native-app'); } catch { /* 無法使用 sessionStorage */ }
    const native = isInFirstRoamLinkApp(document.referrer, remembered);
    if (native) {
      try { window.sessionStorage.setItem('firstroamlink-native-app', '1'); } catch { /* 無法使用 sessionStorage */ }
    }
    const timer = window.setTimeout(() => setInNativeApp(native), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const loadCards = useCallback(async () => {
    setLoadingCards(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user.email?.toLowerCase() || '';
      const [ordersRes, profile] = await Promise.all([
        authenticatedFetch('/api/member/orders'),
        supabase.from('customers').select('token_balance').eq('email', userEmail).maybeSingle()
      ]);
      if (ordersRes.status === 401) {
        setAuthState('out');
        return;
      }
      const json = await ordersRes.json();
      setCards(toCards(json.orders || []));
      const tokenBalance = Number(profile.data?.token_balance);
      setBalance(profile.data && Number.isFinite(tokenBalance) ? tokenBalance : null);
    } catch {
      showToast('讀取 eSIM 失敗，請稍後再試');
    } finally {
      setLoadingCards(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthState(data.session ? 'in' : 'out');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(session ? 'in' : 'out');
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authState !== 'in') return;
    const timer = window.setTimeout(() => { void loadCards(); }, 0);
    return () => window.clearTimeout(timer);
  }, [authState, loadCards]);

  // 剛買的卡在背景配發：有處理中的卡時每 8 秒更新，最多 3 分鐘
  const hasPending = cards.some(card => card.pending);
  useEffect(() => {
    if (!hasPending) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt > 3 * 60_000) window.clearInterval(timer);
      else if (document.visibilityState === 'visible') void loadCards();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [hasPending, loadCards]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(/invalid login credentials/i.test(error.message) ? 'Email 或密碼錯誤' : error.message);
  };

  const refreshOne = async (card: EsimCard) => {
    setRefreshingIds(current => new Set(current).add(card.id));
    try {
      await queryUsage(card);
    } finally {
      setRefreshingIds(current => {
        const next = new Set(current);
        next.delete(card.id);
        return next;
      });
    }
  };

  const queryUsage = async (card: EsimCard) => {
    const res = await authenticatedFetch('/api/member/esim-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_item_id: card.id })
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || '查詢失敗');
    setCards(current => current.map(c => (c.id === card.id ? { ...c, usage: json.usage, usageCheckedAt: json.checkedAt } : c)));
    setSelected(current => (current?.id === card.id ? { ...current, usage: json.usage, usageCheckedAt: json.checkedAt } : current));
  };

  // 一次更新多張用量（同時 4 張）；silent 用在自動更新，不顯示進度與提示
  const refreshMany = useCallback(async (targets: EsimCard[], silent = false) => {
    if (!targets.length || refreshingAllRef.current) return;
    refreshingAllRef.current = true;
    if (!silent) setRefreshProgress({ done: 0, total: targets.length });
    let done = 0;
    let failed = 0;
    const queue = [...targets];
    await Promise.all(Array.from({ length: Math.min(USAGE_CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const card = queue.shift()!;
        try { await refreshOne(card); } catch { failed += 1; }
        done += 1;
        if (!silent) setRefreshProgress({ done, total: targets.length });
      }
    }));
    refreshingAllRef.current = false;
    if (!silent) {
      setRefreshProgress(null);
      showToast(failed ? `已更新 ${targets.length - failed} 張，${failed} 張查詢失敗` : `已更新 ${targets.length} 張 eSIM 用量`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = () => refreshMany(cards.filter(card => card.canQueryUsage));

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  // 自動更新：打開時先更新超過 30 分鐘沒更新的卡，之後每 30 分鐘全部更新一次（畫面在前景時）
  const cardsLoaded = cards.length > 0;
  useEffect(() => {
    if (authState !== 'in' || !cardsLoaded) return;
    const isStale = (card: EsimCard) => !card.usageCheckedAt || Date.now() - new Date(card.usageCheckedAt).getTime() > AUTO_REFRESH_MS;
    void refreshMany(cardsRef.current.filter(card => card.canQueryUsage && isStale(card)), true);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void refreshMany(cardsRef.current.filter(card => card.canQueryUsage), true);
    }, AUTO_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshMany(cardsRef.current.filter(card => card.canQueryUsage && isStale(card)), true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authState, cardsLoaded, refreshMany]);

  const saveNote = async () => {
    if (!selected) return;
    const res = await authenticatedFetch('/api/member/esim', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_item_id: selected.id, action: 'update_note', note: noteDraft.trim() })
    });
    if (!res.ok) { showToast('備註儲存失敗'); return; }
    setCards(current => current.map(c => (c.id === selected.id ? { ...c, note: noteDraft.trim() } : c)));
    setSelected({ ...selected, note: noteDraft.trim() });
    showToast('已儲存備註');
  };

  const copy = async (label: string, value: string) => {
    try { await navigator.clipboard.writeText(value); } catch { window.prompt('請長按複製', value); return; }
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1600);
  };

  const openBuy = async () => {
    setBuy({ step: 'country' });
    setBuyError('');
    setQuantity(1);
    if (!destinations.length) {
      const res = await fetch('/api/products');
      const json = await res.json();
      setDestinations(json.products || []);
    }
  };

  const checkout = async (option: PlanOption) => {
    if (buying) return;
    setBuyError('');
    const total = option.price * quantity;
    if (balance !== null && balance < total) {
      setBuyError(`儲值金不足：需要 NT$${total.toLocaleString()}，目前 NT$${balance.toLocaleString()}`);
      return;
    }
    if (!window.confirm(`確定用儲值金購買 ${quantity} 張？\n合計 NT$${total.toLocaleString()}`)) return;
    const batches = Array.from({ length: Math.ceil(quantity / CHECKOUT_BATCH) }, (_, index) =>
      Math.min(CHECKOUT_BATCH, quantity - index * CHECKOUT_BATCH));
    let purchased = 0;
    setBuying({ done: 0, total: quantity });
    try {
      for (const count of batches) {
        const res = await authenticatedFetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: Array(count).fill(option.id), useTokens: true, paymentMethod: 'TOKENS' })
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || '購買失敗');
        purchased += count;
        setBuying({ done: purchased, total: quantity });
      }
      setBuy(null);
      showToast(`已購買 ${purchased} 張，eSIM 配發中`);
    } catch (err) {
      setBuyError(`${purchased ? `已成功購買 ${purchased} 張，` : ''}${err instanceof Error ? err.message : '購買失敗'}`);
    } finally {
      setBuying(null);
      void loadCards();
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(card => [card.note, card.iccid, card.planName, card.country, card.orderNumber]
      .some(value => String(value || '').toLowerCase().includes(q)));
  }, [cards, query]);

  const activeCount = cards.filter(card => card.usage?.status === '已啟用').length;
  const notInstalledCount = cards.filter(card => !card.pending && (!card.usage || card.usage.status === '尚未安裝')).length;

  if (authState === 'loading') return <main className="grid min-h-[100svh] place-items-center bg-[#12121f] text-white/50">載入中...</main>;

  if (authState === 'out') {
    return (
      <main className="grid min-h-[100svh] place-items-center bg-[#12121f] px-4 text-white">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A1A2E] p-6">
          <p className="text-xs font-bold text-[#ff6b73]">一飛通全球漫遊</p>
          <h1 className="mt-1 text-2xl font-black">eSIM 管理</h1>
          <p className="mt-1 text-sm text-white/50">使用一飛通會員帳號登入</p>
          <label className="mt-5 block text-sm text-white/70">Email
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-400" />
          </label>
          <label className="mt-3 block text-sm text-white/70">密碼
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-400" />
          </label>
          {authError && <p role="alert" className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{authError}</p>}
          <button type="submit" className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-[#ff6b73] to-[#f5bd61] font-black text-[#17131a]">登入</button>
        </form>
      </main>
    );
  }

  const lpa = selected?.smdpAddress && selected.activationCode ? buildLpaString(selected.smdpAddress, selected.activationCode) : null;
  const countries = destinations.filter(d => !countryQuery.trim() || d.country.includes(countryQuery.trim()));

  return (
    <main className="min-h-[100svh] bg-[#12121f] pb-10 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#12121f]/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-white/45">一飛通 eSIM 管理</p>
            <h1 className="text-xl font-black">我的 eSIM <span className="text-white/40">({cards.length})</span></h1>
          </div>
          <button type="button" onClick={refreshAll} disabled={Boolean(refreshProgress)} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 text-xs font-bold text-cyan-100 disabled:opacity-70">
            <RefreshCw size={15} className={refreshProgress ? 'animate-spin' : ''} />
            {refreshProgress ? `${refreshProgress.done}/${refreshProgress.total}` : '全部更新用量'}
          </button>
          <button type="button" onClick={openBuy} aria-label="新增 eSIM" className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-r from-[#ff6b73] to-[#f5bd61] text-[#17131a]">
            <Plus size={22} strokeWidth={3} />
          </button>
        </div>
        <div className="mx-auto mt-3 flex max-w-5xl flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/5 px-3 py-1 text-white/60">已啟用 {activeCount}</span>
          <span className="rounded-full bg-white/5 px-3 py-1 text-white/60">未安裝 {notInstalledCount}</span>
          <span className="rounded-full bg-white/5 px-3 py-1 text-white/40">每 30 分鐘自動更新</span>
          {balance !== null && <span className="ml-auto rounded-full bg-white/5 px-3 py-1 text-yellow-200/80">儲值金 NT${balance.toLocaleString()}</span>}
        </div>
        <label className="mx-auto mt-3 flex max-w-5xl items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
          <Search size={16} className="text-white/35" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜尋備註、ICCID、方案" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30" />
        </label>
      </header>

      <section className="mx-auto grid max-w-5xl gap-3 px-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {loadingCards && !cards.length && <p className="py-16 text-center text-white/40 sm:col-span-2 lg:col-span-3">載入中...</p>}
        {!loadingCards && !cards.length && (
          <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/50 sm:col-span-2 lg:col-span-3">
            還沒有 eSIM，按右上角「＋」選國家和方案購買
          </div>
        )}
        {filtered.map(card => (
          <div
            key={card.id}
            role="button"
            tabIndex={0}
            onClick={() => { setSelected(card); setNoteDraft(card.note); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(card); setNoteDraft(card.note); } }}
            className="cursor-pointer rounded-2xl border border-white/10 bg-[#1A1A2E] p-4 text-left transition-colors hover:border-white/25"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-black">{card.note || '（未命名）'}</p>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${card.pending ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200' : statusClass(card.usage?.status)}`}>
                {card.pending ? '配發中' : card.usage?.status || '未查詢'}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1.5 text-xs">
              <dt className="text-white/40">方案</dt><dd className="min-w-0 truncate text-white/85">{card.planName}</dd>
              <dt className="text-white/40">ICCID</dt><dd className="min-w-0 truncate font-mono text-white/85">{card.iccid || '-'}</dd>
              <dt className="self-center text-white/40">用量</dt>
              <dd className="flex items-center justify-between gap-2">
                <span className="font-bold text-white">{card.usage?.usedData ?? (card.usage ? '尚未回傳' : '-')}</span>
                {card.canQueryUsage && (
                  <button
                    type="button"
                    aria-label="更新這張用量"
                    disabled={refreshingIds.has(card.id)}
                    onClick={async e => {
                      e.stopPropagation();
                      try { await refreshOne(card); } catch (err) { showToast(err instanceof Error ? err.message : '查詢失敗'); }
                    }}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 text-[11px] font-bold text-cyan-100 disabled:opacity-60"
                  >
                    <RefreshCw size={12} className={refreshingIds.has(card.id) ? 'animate-spin' : ''} />
                    {refreshingIds.has(card.id) ? '更新中' : '更新'}
                  </button>
                )}
              </dd>
              <dt className="text-white/40">更新時間</dt>
              <dd className="text-white/60">{formatTime(card.usageCheckedAt)}</dd>
            </dl>
          </div>
        ))}
      </section>

      {selected && (
        <Sheet title={selected.note || selected.planName} onClose={() => setSelected(null)}>
          <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-2 text-sm">
            <dt className="text-white/40">方案</dt><dd>{selected.planName}</dd>
            <dt className="text-white/40">ICCID</dt><dd className="break-all font-mono">{selected.iccid || '-'}</dd>
            <dt className="text-white/40">狀態</dt><dd>{selected.pending ? '配發中' : selected.usage?.status || '未查詢'}</dd>
            <dt className="text-white/40">用量</dt><dd className="font-bold">{selected.usage?.usedData ?? '-'}</dd>
            <dt className="text-white/40">更新時間</dt><dd className="text-white/70">{formatTime(selected.usageCheckedAt)}</dd>
          </dl>
          {selected.canQueryUsage && (
            <button type="button" disabled={refreshingIds.has(selected.id)} onClick={async () => {
              try { await refreshOne(selected); } catch (err) { showToast(err instanceof Error ? err.message : '查詢失敗'); }
            }} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 text-sm font-bold text-cyan-100 disabled:opacity-60">
              <RefreshCw size={15} className={refreshingIds.has(selected.id) ? 'animate-spin' : ''} />更新這張用量
            </button>
          )}

          <label className="mt-4 block text-sm text-white/60">備註（例如使用人）
            <div className="mt-1 flex gap-2">
              <input value={noteDraft} onChange={e => setNoteDraft(e.target.value)} maxLength={50} placeholder="王小明" className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-cyan-400" />
              <button type="button" onClick={saveNote} className="rounded-xl bg-white/10 px-4 text-sm font-bold hover:bg-white/15">儲存</button>
            </div>
          </label>

          {lpa ? (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-black">安裝這張 eSIM</h3>
              <div className="grid gap-2">
                <a href={buildIosInstallUrl(lpa, selected.iosInstallUrl)} className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 text-sm font-black text-[#071317]">iPhone 一鍵安裝</a>
                {selected.androidInstallUrl && (
                  <a href={selected.androidInstallUrl} className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-lime-300 text-sm font-black text-[#071317]">Android 一鍵安裝</a>
                )}
                <a href={buildEasyEuiccIntentUrl(lpa, inNativeApp ? FIRSTROAMLINK_APP_PACKAGE : undefined)} className="flex h-12 flex-col items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-bold">
                  {inNativeApp ? '用讀卡機安裝' : '用 EasyEUICC 安裝'}
                  <span className="text-[11px] font-normal text-white/45">{inNativeApp ? 'USB 讀卡機／實體 eSIM 卡' : 'Android ＋ 實體 eSIM 卡（可插拔 eSIM）'}</span>
                </a>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-white/40">
                {inNativeApp
                  ? '先把 eSIM 卡插進 USB 讀卡機、接上手機，再按「用讀卡機安裝」。第一次使用會詢問 USB 權限，請按允許。只支援實體 eSIM 卡，不能寫入手機內建 eSIM。'
                  : <>EasyEUICC 是開源的 eSIM 管理工具，只支援實體 eSIM 卡，不能寫入手機內建 eSIM。還沒安裝請到 <a href={EASYEUICC_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="underline">easyeuicc.org</a> 下載。</>}
              </p>
              <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3"><QRCodeSVG value={lpa} size={180} /></div>
              <p className="mt-2 text-center text-[11px] text-white/40">用另一支手機掃描也可以安裝</p>
              <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/25 p-3 text-xs">
                {[{ label: 'SM-DP+', value: selected.smdpAddress! }, { label: '啟用碼', value: selected.activationCode! }, { label: 'LPA', value: lpa }].map(field => (
                  <div key={field.label} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1"><p className="text-white/40">{field.label}</p><p className="break-all font-mono">{field.value}</p></div>
                    <button type="button" onClick={() => copy(field.label, field.value)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10" aria-label={`複製${field.label}`}>
                      {copied === field.label ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-100/80">eSIM 配發中，完成後這裡會出現安裝方式。</p>
          )}
          <a href={LINE_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-10 items-center justify-center rounded-xl border border-[#06c755]/30 bg-[#06c755]/10 text-xs font-bold text-[#7ee2a0]">使用上遇到問題？聯繫 LINE 客服</a>
        </Sheet>
      )}

      {buy?.step === 'country' && (
        <Sheet title="新增 eSIM・選擇國家" onClose={() => setBuy(null)}>
          <label className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
            <Search size={16} className="text-white/35" />
            <input value={countryQuery} onChange={e => setCountryQuery(e.target.value)} placeholder="搜尋國家" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          {!destinations.length && <p className="py-8 text-center text-white/40">載入中...</p>}
          <div className="grid grid-cols-2 gap-2">
            {countries.map(destination => (
              <button key={destination.country} type="button" onClick={() => setBuy({ step: 'plan', destination })} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-left text-sm font-bold hover:bg-white/10">
                <span className="text-2xl">{destination.flag || '🌐'}</span>{destination.country}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {buy?.step === 'plan' && (
        <Sheet title={`${buy.destination.flag || ''} ${buy.destination.country}・選擇方案`} onClose={() => setBuy(null)} onBack={() => setBuy({ step: 'country' })}>
          <div className="space-y-4">
            {buy.destination.plans.map(plan => (
              <div key={plan.data}>
                <p className="mb-2 text-sm font-black">{plan.data}</p>
                <div className="grid grid-cols-3 gap-2">
                  {plan.options.map(option => (
                    <button key={option.id} type="button" onClick={() => { setQuantity(1); setBuy({ step: 'confirm', destination: buy.destination, plan, option }); }} className="rounded-xl border border-white/10 bg-white/5 p-2 text-center hover:bg-white/10">
                      <span className="block text-sm font-bold">{option.days} 天</span>
                      <span className="block text-xs text-[#ff8a92]">NT${option.price}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Sheet>
      )}

      {buy?.step === 'confirm' && (
        <Sheet title="確認購買" onClose={() => !buying && setBuy(null)} onBack={buying ? undefined : () => setBuy({ step: 'plan', destination: buy.destination })}>
          <p className="text-sm text-white/60">{buy.destination.flag} {buy.destination.country}</p>
          <p className="mt-1 text-lg font-black">{buy.plan.data}・{buy.option.days} 天</p>
          <p className="text-sm text-white/50">單價 NT${buy.option.price}</p>
          <div className="mt-5 flex items-center justify-center gap-4">
            <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-2xl">−</button>
            <input inputMode="numeric" value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(200, Number(e.target.value.replace(/\D/g, '')) || 1)))} className="h-12 w-24 rounded-xl border border-white/15 bg-black/30 text-center text-2xl font-black outline-none" aria-label="張數" />
            <button type="button" onClick={() => setQuantity(q => Math.min(200, q + 1))} className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-2xl">+</button>
          </div>
          <p className="mt-4 text-center text-sm text-white/60">合計 <span className="text-2xl font-black text-yellow-200">NT${(buy.option.price * quantity).toLocaleString()}</span></p>
          {balance !== null && <p className="text-center text-xs text-white/40">儲值金餘額 NT${balance.toLocaleString()}</p>}
          {buyError && <p role="alert" className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{buyError}</p>}
          <button type="button" disabled={Boolean(buying)} onClick={() => checkout(buy.option)} className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-[#ff6b73] to-[#f5bd61] font-black text-[#17131a] disabled:opacity-60">
            {buying ? `購買中 ${buying.done}/${buying.total}` : `用儲值金購買 ${quantity} 張`}
          </button>
          <p className="mt-2 text-center text-[11px] text-white/40">儲值金不足請聯繫客服儲值；購買後 eSIM 會在背景配發</p>
        </Sheet>
      )}

      {toast && typeof document !== 'undefined' && createPortal(
        <div role="status" className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-[300] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-white px-5 py-3 text-center text-sm font-bold text-black shadow-2xl">{toast}</div>,
        document.body
      )}
    </main>
  );
}
