'use client';

// 企業 eSIM 管理 App（PWA 初版）：卡片列出所有 eSIM、一次更新用量、右上「＋」選國家→方案→張數購買、
// 點卡片選安裝方式（iPhone／Android／EasyEUICC 實體 eSIM 卡／QR Code）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Check, CheckSquare, ChevronDown, ChevronLeft, Copy, FolderInput, Pencil, Plus, RefreshCw, Search, Square, Trash2, Usb, Users, X, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { buildEasyEuiccIntentUrl, buildIosInstallUrl, buildLpaString, EASYEUICC_DOWNLOAD_URL, FIRSTROAMLINK_APP_PACKAGE, FIRSTROAMLINK_READER_URL, isInFirstRoamLinkApp } from '@/lib/esim-install-links';
import { LINE_SUPPORT_URL } from '@/lib/review-eligibility';

interface Usage {
  status?: string;
  usedData?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
}

interface UsageSnapshot {
  checked_at: string;
  status: string | null;
  used_data: string | null;
  used_mb: number | null;
  source: string;
}

const formatMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`);

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
  categoryId: string | null;
  sharedBy: string | null;
  sharedWith: string[];
}

interface Category { id: string; name: string; sort_order: number }
type TabKey = 'all' | 'none' | 'shared' | string;

interface PlanOption { id: string; days: number; price: number }
interface Plan { data: string; options: PlanOption[] }
interface Destination { country: string; flag?: string; region?: string; plans: Plan[] }

type BuyStep = { step: 'country' } | { step: 'plan'; destination: Destination } | { step: 'confirm'; destination: Destination; plan: Plan; option: PlanOption };

const CHECKOUT_BATCH = 100; // 結帳 API 一次最多 100 張
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
  const [history, setHistory] = useState<{ forId: string; rows: UsageSnapshot[]; unavailable?: boolean } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [copied, setCopied] = useState('');
  const [toast, setToast] = useState('');
  const [buy, setBuy] = useState<BuyStep | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [countryQuery, setCountryQuery] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState<{ done: number; total: number } | null>(null);
  const [buyError, setBuyError] = useState('');
  const [inNativeApp, setInNativeApp] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [sharingReady, setSharingReady] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<string[] | null>(null);
  const [memberDraft, setMemberDraft] = useState('');
  const [categoryEdit, setCategoryEdit] = useState<{ id: string | null; name: string } | null>(null);
  const [dragOverTab, setDragOverTab] = useState<TabKey | null>(null);

  // 在一飛通 Android App 裡開啟時，eSIM 卡安裝交給 App 內建的讀卡機功能
  useEffect(() => {
    let remembered: string | null = null;
    try { remembered = window.sessionStorage.getItem('firstroamlink-native-app'); } catch { /* 無法使用 sessionStorage */ }
    const standalone = ['standalone', 'fullscreen', 'minimal-ui'].some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches);
    const native = isInFirstRoamLinkApp({
      referrer: document.referrer,
      remembered,
      search: window.location.search,
      standalone,
      userAgent: navigator.userAgent,
    });
    if (native) {
      try { window.sessionStorage.setItem('firstroamlink-native-app', '1'); } catch { /* 無法使用 sessionStorage */ }
    }
    const readerMissing = new URLSearchParams(window.location.search).get('reader') === 'missing';
    const timer = window.setTimeout(() => {
      setInNativeApp(native);
      if (readerMissing) {
        setToast('找不到 App 內建的讀卡機，請安裝最新版一飛通 eSIM App');
        window.setTimeout(() => setToast(''), 5000);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const loadCards = useCallback(async () => {
    setLoadingCards(true);
    try {
      const res = await authenticatedFetch('/api/member/esim-dashboard');
      if (res.status === 401) {
        setAuthState('out');
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '讀取失敗');
      setSharingReady(json.sharingReady !== false);
      setCards(json.cards || []);
      setCategories(json.categories || []);
      const tokenBalance = Number(json.balance);
      setBalance(json.balance !== null && Number.isFinite(tokenBalance) ? tokenBalance : null);
    } catch {
      showToast('讀取 eSIM 失敗，請稍後再試');
    } finally {
      setLoadingCards(false);
    }
  }, []);

  const dashboardAction = async (payload: Record<string, unknown>) => {
    const res = await authenticatedFetch('/api/member/esim-dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || '操作失敗');
    return json;
  };

  const moveCards = async (ids: string[], categoryId: string | null) => {
    if (!ids.length) return;
    const previous = cards;
    setCards(current => current.map(card => (ids.includes(card.id) ? { ...card, categoryId } : card)));
    setSelected(current => (current && ids.includes(current.id) ? { ...current, categoryId } : current));
    try {
      await dashboardAction({ action: 'move_cards', order_item_ids: ids, category_id: categoryId });
      const target = categoryId ? categories.find(c => c.id === categoryId)?.name : '未分類';
      showToast(`已移動 ${ids.length} 張到「${target || '分類'}」`);
      setSelecting(false);
      setSelectedIds(new Set());
      setMoveOpen(false);
    } catch (err) {
      setCards(previous);
      showToast(err instanceof Error ? err.message : '移動失敗');
    }
  };

  const saveCategory = async () => {
    if (!categoryEdit) return;
    const name = categoryEdit.name.trim();
    if (!name) { showToast('請輸入分類名稱'); return; }
    try {
      if (categoryEdit.id) {
        await dashboardAction({ action: 'rename_category', id: categoryEdit.id, name });
        setCategories(current => current.map(c => (c.id === categoryEdit.id ? { ...c, name } : c)));
      } else {
        const json = await dashboardAction({ action: 'create_category', name });
        if (json.category) {
          setCategories(current => [...current, json.category]);
          setActiveTab(json.category.id);
        }
      }
      setCategoryEdit(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '儲存分類失敗');
    }
  };

  const deleteCategory = async (category: Category) => {
    if (!window.confirm(`刪除分類「${category.name}」？\n裡面的 eSIM 不會被刪除，會回到「未分類」。`)) return;
    try {
      await dashboardAction({ action: 'delete_category', id: category.id });
      setCategories(current => current.filter(c => c.id !== category.id));
      setCards(current => current.map(card => (card.categoryId === category.id ? { ...card, categoryId: null } : card)));
      setActiveTab('all');
      setCategoryEdit(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '刪除分類失敗');
    }
  };

  const shiftCategory = async (category: Category, direction: -1 | 1) => {
    const index = categories.findIndex(c => c.id === category.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    setCategories(next);
    try { await dashboardAction({ action: 'reorder_categories', ids: next.map(c => c.id) }); } catch { showToast('排序儲存失敗'); }
  };

  // 共享：把自己買的卡共享給某個 Email（對方只能查看與掃 QR Code）
  const shareCards = async (ids: string[], memberEmail: string) => {
    const value = memberEmail.trim().toLowerCase();
    const ownIds = ids.filter(id => cards.find(card => card.id === id && !card.sharedBy));
    if (!value || !ownIds.length) { showToast('請選擇自己購買的 eSIM'); return; }
    try {
      const result = await dashboardAction({ action: 'share_cards', order_item_ids: ownIds, email: value });
      setCards(current => current.map(card => (ownIds.includes(card.id) && !card.sharedWith.includes(value) ? { ...card, sharedWith: [...card.sharedWith, value] } : card)));
      setSelected(current => (current && ownIds.includes(current.id) && !current.sharedWith.includes(value) ? { ...current, sharedWith: [...current.sharedWith, value] } : current));
      setMemberDraft('');
      setShareTarget(null);
      setSelecting(false);
      setSelectedIds(new Set());
      showToast(`已共享 ${ownIds.length} 張給 ${value}${result?.notified ? '，已寄信通知對方' : ''}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '共享失敗');
    }
  };

  const unshareCards = async (ids: string[], memberEmail: string, ask = true) => {
    if (ask && !window.confirm(`停止把 ${ids.length} 張 eSIM 共享給 ${memberEmail}？`)) return;
    try {
      await dashboardAction({ action: 'unshare_cards', order_item_ids: ids, email: memberEmail });
      const drop = (card: EsimCard) => (ids.includes(card.id) ? { ...card, sharedWith: card.sharedWith.filter(e => e !== memberEmail) } : card);
      setCards(current => current.map(drop));
      setSelected(current => (current ? drop(current) : current));
    } catch (err) {
      showToast(err instanceof Error ? err.message : '取消共享失敗');
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleLogout = async () => {
    if (!window.confirm('確定要登出嗎？')) return;
    await supabase.auth.signOut();
    setCards([]);
    setSelected(null);
  };

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
    setAuthNotice('');
    if (registerMode) {
      if (password.length < 6) { setAuthError('密碼至少 6 個字元'); return; }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setAuthError(`註冊失敗：${error.message}`); return; }
      if (data.user && data.user.identities?.length === 0) {
        setRegisterMode(false);
        setAuthError('這個 Email 已經註冊過，請直接登入');
        return;
      }
      if (!data.session) {
        setRegisterMode(false);
        setAuthNotice('註冊成功！請到信箱點擊驗證連結，再回來登入。');
      }
      return;
    }
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

  const loadHistory = async () => {
    if (!selected) return;
    if (history?.forId === selected.id) { setHistory(null); return; }
    setHistoryLoading(true);
    try {
      const res = await authenticatedFetch(`/api/member/esim-usage?order_item_id=${encodeURIComponent(selected.id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '查詢失敗');
      setHistory({ forId: selected.id, rows: json.snapshots || [], unavailable: json.unavailable });
    } catch (err) {
      showToast(err instanceof Error ? err.message : '查詢用量紀錄失敗');
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteCard = async () => {
    if (!selected) return;
    const name = selected.note || selected.iccid || selected.planName;
    if (!window.confirm(`確定要從列表刪除「${name}」嗎？\n刪除後這張 eSIM 不會再顯示在 App 和會員中心。`)) return;
    const res = await authenticatedFetch('/api/member/esim', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_item_id: selected.id, action: 'soft_delete' })
    });
    if (!res.ok) { showToast('刪除失敗，請稍後再試'); return; }
    setCards(current => current.filter(c => c.id !== selected.id));
    setSelected(null);
    showToast('已刪除');
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

  const categoryIds = useMemo(() => new Set(categories.map(c => c.id)), [categories]);
  const cardTabs = useMemo(() => new Map<string, TabKey>(cards.map(card => [
    card.id,
    card.categoryId && categoryIds.has(card.categoryId) ? card.categoryId : 'none'
  ])), [cards, categoryIds]);
  const tabCounts = useMemo(() => {
    const counts = new Map<TabKey, number>();
    for (const tab of cardTabs.values()) counts.set(tab, (counts.get(tab) || 0) + 1);
    return counts;
  }, [cardTabs]);
  const tabCards = useMemo(() => {
    if (activeTab === 'all') return cards;
    if (activeTab === 'shared') return cards.filter(card => card.sharedBy);
    return cards.filter(card => cardTabs.get(card.id) === activeTab);
  }, [cards, activeTab, cardTabs]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tabCards;
    return tabCards.filter(card => [card.note, card.iccid, card.planName, card.country, card.orderNumber]
      .some(value => String(value || '').toLowerCase().includes(q)));
  }, [tabCards, query]);
  const sharedCount = cards.filter(card => card.sharedBy).length;
  const ownCards = cards.filter(card => !card.sharedBy);
  const shareSummary = (() => {
    const map = new Map<string, string[]>();
    for (const card of ownCards) for (const e of card.sharedWith) map.set(e, [...(map.get(e) || []), card.id]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  })();
  const selectedOwnIds = [...selectedIds].filter(id => ownCards.some(card => card.id === id));
  const isOwnCard = (card: EsimCard | null) => Boolean(card && !card.sharedBy);
  const refreshAll = () => refreshMany(tabCards.filter(card => card.canQueryUsage));

  const activeCount = tabCards.filter(card => card.usage?.status === '已啟用').length;
  const notInstalledCount = tabCards.filter(card => !card.pending && (!card.usage || card.usage.status === '尚未安裝')).length;

  if (authState === 'loading') return <main className="grid min-h-[100svh] place-items-center bg-[#12121f] text-white/50">載入中...</main>;

  if (authState === 'out') {
    return (
      <main className="grid min-h-[100svh] place-items-center bg-[#12121f] px-4 text-white">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A1A2E] p-6">
          <p className="text-xs font-bold text-[#ff6b73]">一飛通全球漫遊</p>
          <h1 className="mt-1 text-2xl font-black">eSIM 管理</h1>
          <p className="mt-1 text-sm text-white/50">{registerMode ? '建立一飛通會員帳號' : '使用一飛通會員帳號登入'}</p>
          <label className="mt-5 block text-sm text-white/70">Email
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-400" />
          </label>
          <label className="mt-3 block text-sm text-white/70">密碼
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-400" />
          </label>
          {authError && <p role="alert" className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{authError}</p>}
          {authNotice && <p role="status" className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{authNotice}</p>}
          <button type="submit" className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-[#ff6b73] to-[#f5bd61] font-black text-[#17131a]">{registerMode ? '註冊' : '登入'}</button>
          <button type="button" onClick={() => { setRegisterMode(mode => !mode); setAuthError(''); setAuthNotice(''); }} className="mt-3 w-full text-center text-xs text-white/50 underline underline-offset-4">
            {registerMode ? '已經有帳號？登入' : '被邀請一起監控？用受邀 Email 註冊帳號'}
          </button>
        </form>
      </main>
    );
  }

  const lpa = selected?.smdpAddress && selected.activationCode ? buildLpaString(selected.smdpAddress, selected.activationCode) : null;
  const countries = destinations.filter(d => !countryQuery.trim() || d.country.includes(countryQuery.trim()));

  return (
    <main className="min-h-[100svh] bg-[#12121f] pb-10 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#12121f]/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <h1 className="min-w-0 flex-1 truncate text-sm font-bold">我的 eSIM</h1>
          <span className="shrink-0 text-[11px] text-white/40">{cards.length} 張</span>
          {balance !== null && <span className="shrink-0 whitespace-nowrap rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-yellow-200/80">NT${balance.toLocaleString()}</span>}
          {inNativeApp && (
            <a href={FIRSTROAMLINK_READER_URL} aria-label="讀卡機管理" title="讀卡機" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/5 text-white/85">
              <Usb size={17} />
            </a>
          )}
          {sharingReady && ownCards.length > 0 && (
            <button type="button" onClick={() => setShareOpen(true)} aria-label="共享管理" title="共享管理" className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/5 text-white/85">
              <Users size={17} />
              {shareSummary.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-cyan-400 px-1 text-[9px] font-black text-[#071317]">{shareSummary.length}</span>}
            </button>
          )}
          <button type="button" onClick={refreshAll} disabled={Boolean(refreshProgress)} aria-label="更新這個分頁的用量" title="更新這個分頁的用量" className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-2 text-[11px] font-bold text-cyan-100 disabled:opacity-70">
            <RefreshCw size={17} className={refreshProgress ? 'animate-spin' : ''} />
            {refreshProgress && `${refreshProgress.done}/${refreshProgress.total}`}
          </button>
          <button type="button" onClick={handleLogout} aria-label="登出" title="登出" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/5 text-white/70">
            <LogOut size={17} />
          </button>
          {(
            <button type="button" onClick={openBuy} aria-label="新增 eSIM" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-[#ff6b73] to-[#f5bd61] text-[#17131a]">
              <Plus size={20} strokeWidth={3} />
            </button>
          )}
        </div>

        {sharingReady && (
          <nav aria-label="分類" className="mx-auto mt-2 flex max-w-7xl items-end gap-1 overflow-x-auto border-b border-white/10 [scrollbar-width:none]">
            {([{ key: 'all', label: '全部', count: cards.length }, ...(sharedCount ? [{ key: 'shared', label: '共享給我', count: sharedCount }] : []), ...categories.map(c => ({ key: c.id, label: c.name, count: tabCounts.get(c.id) || 0 })), { key: 'none', label: '未分類', count: tabCounts.get('none') || 0 }] as { key: TabKey; label: string; count: number }[]).map(tab => {
              const active = activeTab === tab.key;
              const droppable = tab.key !== 'all' && tab.key !== 'shared';
              const editable = active && tab.key !== 'all' && tab.key !== 'none' && tab.key !== 'shared';
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => (editable ? setCategoryEdit({ id: tab.key, name: tab.label }) : setActiveTab(tab.key))}
                  onDragOver={droppable ? e => { e.preventDefault(); setDragOverTab(tab.key); } : undefined}
                  onDragLeave={droppable ? () => setDragOverTab(null) : undefined}
                  onDrop={droppable ? e => {
                    e.preventDefault();
                    setDragOverTab(null);
                    const ids = (e.dataTransfer.getData('text/plain') || '').split(',').filter(Boolean);
                    void moveCards(ids, tab.key === 'none' ? null : tab.key);
                  } : undefined}
                  title={editable ? '再點一次可改名或刪除' : tab.label}
                  className={`flex shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-1.5 text-xs font-bold transition-colors ${active ? 'border-white/15 bg-[#1A1A2E] text-white' : 'border-transparent text-white/50 hover:text-white/80'} ${dragOverTab === tab.key ? 'bg-cyan-400/20 text-cyan-100' : ''}`}
                >
                  <span className="max-w-[9rem] truncate">{tab.label}</span>
                  <span className="text-[10px] font-normal text-white/40">{tab.count}</span>
                  {editable && <Pencil size={11} className="text-white/45" />}
                </button>
              );
            })}
            {(
              <button type="button" onClick={() => setCategoryEdit({ id: null, name: '' })} aria-label="新增分類" title="新增分類" className="mb-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white">
                <Plus size={15} />
              </button>
            )}
          </nav>
        )}

        <div className="mx-auto mt-2 flex max-w-7xl items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
            <Search size={15} className="text-white/35" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜尋備註、ICCID、方案" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30" />
          </label>
          {sharingReady && (
            <button type="button" onClick={() => { setSelecting(on => !on); setSelectedIds(new Set()); }} className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border px-2.5 text-xs font-bold ${selecting ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-100' : 'border-white/10 bg-white/5 text-white/70'}`}>
              <CheckSquare size={14} />{selecting ? '取消' : '選取'}
            </button>
          )}
          <span className="hidden shrink-0 whitespace-nowrap text-[11px] text-white/45 sm:inline" title="每 30 分鐘自動更新用量">啟用 {activeCount}・未裝 {notInstalledCount}</span>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl grid-cols-2 gap-2 px-3 pt-3 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {loadingCards && !cards.length && <p className="col-span-full py-16 text-center text-white/40">載入中...</p>}
        {!loadingCards && !cards.length && (
          <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/50">
            還沒有 eSIM，按右上角「＋」選國家和方案購買
          </div>
        )}
        {!loadingCards && cards.length > 0 && !filtered.length && (
          <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/45">
            {query.trim() ? '找不到符合的 eSIM' : '這個分類還沒有 eSIM。按「選取」勾選卡片後「移到」這裡，電腦也可以直接把卡片拖到分頁上。'}
          </div>
        )}
        {filtered.map(card => (
          <div
            key={card.id}
            role="button"
            tabIndex={0}
            draggable={sharingReady}
            onDragStart={e => {
              const ids = selecting && selectedIds.has(card.id) ? [...selectedIds] : [card.id];
              e.dataTransfer.setData('text/plain', ids.join(','));
              e.dataTransfer.effectAllowed = 'move';
            }}
            onClick={() => { if (selecting) { toggleSelected(card.id); return; } setSelected(card); setNoteDraft(card.note); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (selecting) { toggleSelected(card.id); return; } setSelected(card); setNoteDraft(card.note); } }}
            className={`min-w-0 cursor-pointer rounded-2xl border bg-[#1A1A2E] p-2.5 sm:p-3 text-left transition-colors ${selecting && selectedIds.has(card.id) ? 'border-cyan-400/70 ring-1 ring-cyan-400/40' : 'border-white/10 hover:border-white/25'}`}
          >
            <div className="flex items-start justify-between gap-1">
              {selecting && (selectedIds.has(card.id) ? <CheckSquare size={16} className="shrink-0 text-cyan-300" /> : <Square size={16} className="shrink-0 text-white/35" />)}
              <p className="min-w-0 flex-1 truncate text-sm font-black">{card.note || '（未命名）'}</p>
              <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${card.pending ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200' : statusClass(card.usage?.status)}`}>
                {card.pending ? '配發中' : card.usage?.status || '未查詢'}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-white/60">{card.planName}</p>
            <div className="mt-2 flex items-center gap-1">
              <span className="min-w-0 flex-1 font-mono text-[9.5px] tracking-tighter text-white/80 [overflow-wrap:anywhere]">{card.iccid || '-'}</span>
              {card.iccid && (
                <button
                  type="button"
                  aria-label="複製 ICCID"
                  onClick={e => { e.stopPropagation(); copy(`iccid-${card.id}`, card.iccid || ''); }}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/10 text-white/80"
                >
                  {copied === `iccid-${card.id}` ? <Check size={13} /> : <Copy size={13} />}
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-1">
              <span className="min-w-0 truncate text-base font-black text-white">{card.usage?.usedData ?? (card.usage ? '尚未回傳' : '-')}</span>
              {card.canQueryUsage && (
                <button
                  type="button"
                  aria-label="更新這張用量"
                  disabled={refreshingIds.has(card.id)}
                  onClick={async e => {
                    e.stopPropagation();
                    try { await refreshOne(card); } catch (err) { showToast(err instanceof Error ? err.message : '查詢失敗'); }
                  }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-100 disabled:opacity-60"
                >
                  <RefreshCw size={13} className={refreshingIds.has(card.id) ? 'animate-spin' : ''} />
                </button>
              )}
            </div>
            <p className="mt-0.5 text-[10px] text-white/40">更新 {formatTime(card.usageCheckedAt)}</p>
            {card.sharedBy && <p className="mt-1 truncate text-[10px] text-amber-200/70">🔗 由 {card.sharedBy} 共享</p>}
            {!card.sharedBy && card.sharedWith.length > 0 && <p className="mt-1 truncate text-[10px] text-cyan-200/60">👥 已共享 {card.sharedWith.length} 人</p>}
            {activeTab === 'all' && card.categoryId && categoryIds.has(card.categoryId) && (
              <p className="mt-1 truncate text-[10px] text-cyan-200/60">📁 {categories.find(c => c.id === card.categoryId)?.name}</p>
            )}
          </div>
        ))}
      </section>

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#1A1A2E]/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-2">
            <span className="min-w-0 flex-1 text-sm font-bold">已選 {selectedIds.size} 張</span>
            <button type="button" onClick={() => setSelectedIds(current => (current.size === filtered.length ? new Set() : new Set(filtered.map(card => card.id))))} className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white/80">
              {selectedIds.size === filtered.length && filtered.length > 0 ? '全不選' : '全選'}
            </button>
            <button type="button" disabled={!selectedOwnIds.length} onClick={() => setShareTarget(selectedOwnIds)} title="共享選取的卡（只限自己購買的卡）" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 text-sm font-bold text-cyan-100 disabled:opacity-40">
              <Users size={16} />共享
            </button>
            <button type="button" disabled={!selectedIds.size} onClick={() => setMoveOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-cyan-400 px-4 text-sm font-black text-[#071317] disabled:opacity-40">
              <FolderInput size={16} />移到
            </button>
          </div>
        </div>
      )}

      {selected && (
        <Sheet title={selected.note || selected.planName} onClose={() => setSelected(null)}>
          <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-2 text-sm">
            <dt className="text-white/40">方案</dt><dd>{selected.planName}</dd>
            <dt className="text-white/40">ICCID</dt><dd className="break-all font-mono">{selected.iccid || '-'}</dd>
            <dt className="text-white/40">狀態</dt><dd>{selected.pending ? '配發中' : selected.usage?.status || '未查詢'}</dd>
            <dt className="text-white/40">用量</dt><dd className="font-bold">{selected.usage?.usedData ?? '-'}</dd>
            <dt className="text-white/40">更新時間</dt><dd className="text-white/70">{formatTime(selected.usageCheckedAt)}</dd>
          </dl>
          {(selected.usage?.status === '已下載' || selected.usage?.status === '已安裝') && (
            <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] leading-5 text-amber-100/85">
              電信商還沒回報這張卡「已啟用」。實際上可能已經在用，用量通常要等電信商回報啟用後才會一次補上，可能延遲數小時。
            </p>
          )}
          {sharingReady && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <span className="shrink-0 text-white/40">分類</span>
              <select
                value={selected.categoryId && categoryIds.has(selected.categoryId) ? selected.categoryId : ''}
                onChange={e => void moveCards([selected.id], e.target.value || null)}
                className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-cyan-400"
              >
                <option value="" className="bg-[#1A1A2E]">未分類</option>
                {categories.map(c => <option key={c.id} value={c.id} className="bg-[#1A1A2E]">{c.name}</option>)}
              </select>
            </label>
          )}
          {selected.canQueryUsage && (
            <button type="button" disabled={refreshingIds.has(selected.id)} onClick={async () => {
              try { await refreshOne(selected); } catch (err) { showToast(err instanceof Error ? err.message : '查詢失敗'); }
            }} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 text-sm font-bold text-cyan-100 disabled:opacity-60">
              <RefreshCw size={15} className={refreshingIds.has(selected.id) ? 'animate-spin' : ''} />更新這張用量
            </button>
          )}

          <button type="button" onClick={loadHistory} disabled={historyLoading} className="mt-3 flex h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold disabled:opacity-60">
            <span>{historyLoading ? '載入中...' : '用量紀錄（每 30 分鐘）'}</span>
            <ChevronDown size={16} className={history?.forId === selected.id ? 'rotate-180' : ''} />
          </button>
          {history?.forId === selected.id && (
            <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-black/20">
              {history.rows.length === 0 ? (
                <p className="p-4 text-center text-xs text-white/45">{history.unavailable ? '用量紀錄功能尚未啟用' : '還沒有紀錄，之後每 30 分鐘會自動記錄一次'}</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#1A1A2E] text-white/40">
                    <tr><th className="px-3 py-2 text-left font-normal">時間</th><th className="px-3 py-2 text-right font-normal">累計用量</th><th className="px-3 py-2 text-right font-normal">這段增加</th></tr>
                  </thead>
                  <tbody>
                    {history.rows.map((row, index) => {
                      const older = history.rows[index + 1];
                      const delta = row.used_mb != null && older?.used_mb != null ? row.used_mb - older.used_mb : null;
                      return (
                        <tr key={`${row.checked_at}-${index}`} className="border-t border-white/5">
                          <td className="px-3 py-1.5 text-white/60">{formatTime(row.checked_at)}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{row.used_data ?? '-'}</td>
                          <td className={`px-3 py-1.5 text-right font-mono ${delta && delta > 0 ? 'text-cyan-200' : 'text-white/30'}`}>{delta == null ? '' : delta > 0 ? `+${formatMb(delta)}` : '0'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {sharingReady && isOwnCard(selected) && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">共享給</p>
                <button type="button" onClick={() => setShareTarget([selected.id])} className="inline-flex h-8 items-center gap-1 rounded-lg bg-cyan-400/15 px-2.5 text-xs font-bold text-cyan-100"><Plus size={13} />新增</button>
              </div>
              {selected.sharedWith.length === 0 ? (
                <p className="mt-1 text-xs text-white/40">還沒有共享。共享後對方只能查看用量和掃 QR Code 安裝。</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selected.sharedWith.map(e => (
                    <span key={e} className="inline-flex items-center gap-1 rounded-full bg-black/30 py-1 pl-2.5 pr-1 text-xs">
                      {e}
                      <button type="button" onClick={() => void unshareCards([selected.id], e)} aria-label={`取消共享給 ${e}`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-white/10"><X size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {isOwnCard(selected) ? (
          <label className="mt-4 block text-sm text-white/60">備註（例如使用人）
            <div className="mt-1 flex gap-2">
              <input value={noteDraft} onChange={e => setNoteDraft(e.target.value)} maxLength={50} placeholder="王小明" className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-cyan-400" />
              <button type="button" onClick={saveNote} className="rounded-xl bg-white/10 px-4 text-sm font-bold hover:bg-white/15">儲存</button>
            </div>
          </label>
          ) : selected.note ? (
            <p className="mt-4 text-sm text-white/60">備註：<span className="text-white">{selected.note}</span></p>
          ) : null}

          {selected.sharedBy && (
            <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-white/60">這張卡由 {selected.sharedBy} 共享給你，可以查看用量和掃描 QR Code 安裝；備註與刪除只有購買者能修改。你可以把它放進自己的分類。</p>
          )}
          {lpa ? (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-black">安裝這張 eSIM</h3>
              <div className="grid gap-2">
                <a href={buildIosInstallUrl(lpa, selected.iosInstallUrl)} className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 text-sm font-black text-[#071317]">iPhone 一鍵安裝</a>
                {selected.androidInstallUrl && (
                  <a href={selected.androidInstallUrl} className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-lime-300 text-sm font-black text-[#071317]">Android 一鍵安裝</a>
                )}
                <a href={buildEasyEuiccIntentUrl(lpa, inNativeApp ? FIRSTROAMLINK_APP_PACKAGE : undefined, selected.country)} className="flex h-12 flex-col items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-bold">
                  {inNativeApp ? '用讀卡機安裝' : '用 EasyEUICC 安裝'}
                  <span className="text-[11px] font-normal text-white/45">{inNativeApp ? 'USB 讀卡機／實體 eSIM 卡' : 'Android ＋ 實體 eSIM 卡（可插拔 eSIM）'}</span>
                </a>
                {inNativeApp && (
                  <a href={buildEasyEuiccIntentUrl(lpa)} className="flex h-12 flex-col items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-bold">
                    用官方 EasyEUICC 安裝
                    <span className="text-[11px] font-normal text-white/45">eSIM 卡直接插在手機 SIM 卡槽</span>
                  </a>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-5 text-white/40">
                {inNativeApp
                  ? <>用 USB 讀卡機：先把 eSIM 卡插進讀卡機、接上手機，再按「用讀卡機安裝」，第一次會詢問 USB 權限，請按允許。eSIM 卡直接插在手機 SIM 卡槽時，卡片通常只開放給官方 EasyEUICC 讀取，請按「用官方 EasyEUICC 安裝」（還沒安裝請到 <a href={EASYEUICC_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="underline">easyeuicc.org</a> 下載）。都不能寫入手機內建 eSIM。</>
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
          {isOwnCard(selected) && (
            <button type="button" onClick={deleteCard} className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 text-xs font-bold text-red-200">
              <Trash2 size={14} />刪除這張 eSIM
            </button>
          )}
        </Sheet>
      )}

      {moveOpen && (
        <Sheet title={`移動 ${selectedIds.size} 張 eSIM 到…`} onClose={() => setMoveOpen(false)}>
          <div className="grid gap-2">
            {categories.map(c => (
              <button key={c.id} type="button" onClick={() => void moveCards([...selectedIds], c.id)} className="flex h-12 items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 text-left text-sm font-bold hover:bg-white/10">
                <span className="truncate">📁 {c.name}</span><span className="text-xs font-normal text-white/40">{tabCounts.get(c.id) || 0} 張</span>
              </button>
            ))}
            <button type="button" onClick={() => void moveCards([...selectedIds], null)} className="flex h-12 items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 text-left text-sm font-bold hover:bg-white/10">
              <span>未分類</span><span className="text-xs font-normal text-white/40">{tabCounts.get('none') || 0} 張</span>
            </button>
            <button type="button" onClick={() => { setMoveOpen(false); setCategoryEdit({ id: null, name: '' }); }} className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 text-sm font-bold text-white/60 hover:bg-white/5">
              <Plus size={15} />新增分類
            </button>
          </div>
        </Sheet>
      )}

      {categoryEdit && (
        <Sheet title={categoryEdit.id ? '分類設定' : '新增分類'} onClose={() => setCategoryEdit(null)}>
          <form onSubmit={e => { e.preventDefault(); void saveCategory(); }}>
            <label className="block text-sm text-white/60">分類名稱
              <input autoFocus value={categoryEdit.name} maxLength={30} onChange={e => setCategoryEdit({ ...categoryEdit, name: e.target.value })} placeholder="例如：日本團、業務部" className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-cyan-400" />
            </label>
            <button type="submit" className="mt-3 h-11 w-full rounded-xl bg-cyan-400 text-sm font-black text-[#071317]">{categoryEdit.id ? '儲存名稱' : '建立分類'}</button>
          </form>
          {categoryEdit.id && (() => {
            const category = categories.find(c => c.id === categoryEdit.id);
            if (!category) return null;
            const index = categories.indexOf(category);
            return (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button type="button" disabled={index === 0} onClick={() => void shiftCategory(category, -1)} className="h-10 rounded-xl border border-white/10 text-xs font-bold text-white/70 disabled:opacity-30">← 往前</button>
                <button type="button" disabled={index === categories.length - 1} onClick={() => void shiftCategory(category, 1)} className="h-10 rounded-xl border border-white/10 text-xs font-bold text-white/70 disabled:opacity-30">往後 →</button>
                <button type="button" onClick={() => void deleteCategory(category)} className="h-10 rounded-xl border border-red-500/25 bg-red-500/10 text-xs font-bold text-red-200">刪除分類</button>
              </div>
            );
          })()}
        </Sheet>
      )}

      {shareTarget && (
        <Sheet title={`共享 ${shareTarget.length} 張 eSIM`} onClose={() => setShareTarget(null)}>
          <p className="text-sm leading-6 text-white/60">輸入對方 Email。對方用這個 Email 註冊／登入 <span className="font-mono text-white/80">firstesim.space/app</span> 後，會在自己的頁面看到這些卡，可以查看用量、掃 QR Code 安裝，也能放進自己的分類；不能刪除或修改。</p>
          <form onSubmit={e => { e.preventDefault(); void shareCards(shareTarget, memberDraft); }} className="mt-4 flex gap-2">
            <input type="email" required autoFocus value={memberDraft} onChange={e => setMemberDraft(e.target.value)} placeholder="name@company.com" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-cyan-400" />
            <button type="submit" className="shrink-0 rounded-xl bg-cyan-400 px-4 text-sm font-black text-[#071317]">共享</button>
          </form>
          {shareSummary.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-white/40">之前共享過的 Email</p>
              <div className="flex flex-wrap gap-1.5">
                {shareSummary.map(([e]) => (
                  <button key={e} type="button" onClick={() => void shareCards(shareTarget, e)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">{e}</button>
                ))}
              </div>
            </div>
          )}
        </Sheet>
      )}

      {shareOpen && (
        <Sheet title="共享管理" onClose={() => setShareOpen(false)}>
          <p className="text-sm leading-6 text-white/60">要共享卡片：按「選取」勾選卡片 →「共享」，或點開單張卡 →「共享給」→「新增」。對方只能查看用量和掃 QR Code 安裝，分類由對方自己整理。</p>
          <div className="mt-4 space-y-2">
            {shareSummary.length === 0 && <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-xs text-white/40">目前沒有共享任何卡</p>}
            {shareSummary.map(([e, ids]) => (
              <div key={e} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{e}</p>
                  <p className="text-[11px] text-white/40">共享 {ids.length} 張</p>
                </div>
                <button type="button" onClick={() => void unshareCards(ids, e)} className="h-8 shrink-0 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 text-xs font-bold text-red-200">全部取消</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => copy('share-link', 'https://firstesim.space/app')} className="mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-white/70">
            {copied === 'share-link' ? <Check size={14} /> : <Copy size={14} />}複製管理頁網址
          </button>
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
