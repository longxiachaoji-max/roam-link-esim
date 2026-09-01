'use client';

import { adminFetch } from '@/lib/admin-fetch';
import { compareEsimPlanOrder } from '@/lib/esim-plan-sort';
import { getMicroesimPlanSpeedTier } from '@/lib/microesim-plan-group';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Check, DownloadCloud, Filter, LayoutGrid, List, Loader2, Search, Star, UploadCloud } from 'lucide-react';

type SupplierPlan = {
  supplier_plan_id: string;
  supplier_plan_name: string;
  name: string;
  country: string;
  data_amount: string;
  hotspot_sharing: string;
  validity_days: number;
  price: number;
  cost_original: number;
  cost_currency: string;
  cost_twd: number;
  suggested_price: number;
  margin_twd: number;
  carrier: string;
  networks: string;
  apn: string;
  active_type_note: string;
  rule_desc_zh: string;
  special_desc_zh: string;
  customer_note: string;
  internal_warning: string;
  flags: {
    kyc: boolean;
    noReinstall: boolean;
    noHotspot: boolean;
    noGpt: boolean;
    speedLimit: boolean;
    terminateAfterUse: boolean;
  };
  raw: Record<string, unknown>;
};

type CountryOption = {
  code: string;
  name: string;
};

type SyncResult = {
  plans: SupplierPlan[];
  scanned: number;
  total: number;
  totalPages: number;
  country: CountryOption;
  rates: {
    hkdRate: number;
    usdRate: number;
    markup: number;
  };
};

const countryOptions: CountryOption[] = [
  { code: 'MULTI', name: '多國/區域' },
  { code: 'KR', name: '韓國' },
  { code: 'JP', name: '日本' },
  { code: 'TH', name: '泰國' },
  { code: 'VN', name: '越南' },
  { code: 'SG', name: '新加坡' },
  { code: 'MY', name: '馬來西亞' },
  { code: 'CN', name: '中國' },
  { code: 'HK', name: '香港' },
  { code: 'MO', name: '澳門' },
  { code: 'TW', name: '台灣' },
  { code: 'US', name: '美國' },
  { code: 'CA', name: '加拿大' },
  { code: 'GB', name: '英國' },
  { code: 'FR', name: '法國' },
  { code: 'DE', name: '德國' },
  { code: 'IT', name: '義大利' },
  { code: 'ES', name: '西班牙' },
  { code: 'NL', name: '荷蘭' },
  { code: 'CH', name: '瑞士' },
  { code: 'TR', name: '土耳其' },
  { code: 'AU', name: '澳洲' },
  { code: 'NZ', name: '紐西蘭' },
  { code: 'ID', name: '印尼' },
  { code: 'PH', name: '菲律賓' },
  { code: 'IN', name: '印度' },
  { code: 'KH', name: '柬埔寨' }
];

type SortField = 'default' | 'name' | 'supplierName' | 'carrier' | 'cost' | 'suggestedPrice' | 'note' | 'flags';
type SortDirection = 'asc' | 'desc';
type PlanTypeFilter = 'metered' | 'daily' | 'unlimited' | 'throttledUnlimited' | 'highSpeedUnlimited';
type ViewMode = 'cards' | 'table';

type PlanGroup = {
  key: string;
  supplierBaseName: string;
  groupCode: string;
  speedTier: string;
  plans: SupplierPlan[];
};

const planTypeOptions: { key: PlanTypeFilter; label: string }[] = [
  { key: 'metered', label: '計量型' },
  { key: 'daily', label: '計日型' },
  { key: 'unlimited', label: '吃到飽' },
  { key: 'throttledUnlimited', label: '限速吃到飽' },
  { key: 'highSpeedUnlimited', label: '高速吃到飽' }
];

const FAVORITES_STORAGE_KEY = 'firstroamlink.microesim.favoritePlanIds';
const FAVORITES_BACKUP_STORAGE_KEY = 'firstroamlink.microesim.favoritePlanIds.backup';

const sortLabels: Partial<Record<SortField, [string, string]>> = {
  name: ['A-Z', 'Z-A'],
  supplierName: ['A-Z', 'Z-A'],
  carrier: ['A-Z', 'Z-A'],
  cost: ['低到高', '高到低'],
  suggestedPrice: ['低到高', '高到低'],
  note: ['A-Z', 'Z-A'],
  flags: ['少到多', '多到少']
};

function money(value: number) {
  return `NT$${Math.round(value || 0).toLocaleString('zh-TW')}`;
}

function getPlanFamily(plan: SupplierPlan) {
  const supplierName = plan.supplier_plan_name.trim();
  const suffixMatch = supplierName.match(/-(\d+)-([a-z]+\d+)$/i);
  if (suffixMatch) {
    return {
      supplierBaseName: supplierName.slice(0, -suffixMatch[0].length),
      groupCode: suffixMatch[2].toUpperCase()
    };
  }

  const dayPattern = new RegExp(`-${plan.validity_days}(?=-|$)`, 'i');
  const withoutDay = supplierName.replace(dayPattern, '');
  const groupMatch = withoutDay.match(/-([a-z]+\d+)$/i);
  return {
    supplierBaseName: groupMatch ? withoutDay.slice(0, -groupMatch[0].length) : withoutDay,
    groupCode: groupMatch?.[1]?.toUpperCase() || '未分組'
  };
}

function getPlanFamilyTitle(plan: SupplierPlan) {
  const isLocalPlan = /local/i.test(plan.supplier_plan_name);
  const networkLabel = isLocalPlan
    ? `${plan.carrier || (/local\s*iij/i.test(plan.supplier_plan_name) ? 'Docomo' : '未標示電信商')} 本地網路`
    : '';
  return [plan.country, networkLabel, plan.data_amount].filter(Boolean).join('｜');
}

function yesNoBadge(active: boolean, label: string, activeClass = 'bg-red-500/15 text-red-200 border-red-400/30') {
  if (!active) return null;
  return <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] ${activeClass}`}>{label}</span>;
}

function SortHeader({
  label,
  field,
  align = 'left',
  sortField,
  sortDirection,
  onSort
}: {
  label: string;
  field: Exclude<SortField, 'default'>;
  align?: 'left' | 'right';
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: Exclude<SortField, 'default'>) => void;
}) {
  const isActive = sortField === field;
  const activeLabel = sortLabels[field]?.[sortDirection === 'asc' ? 0 : 1];
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white ${align === 'right' ? 'ml-auto' : ''}`}
    >
      {label}
      <ArrowDownUp className="h-3.5 w-3.5" />
      {isActive && activeLabel && <span className="text-cyan-200">{activeLabel}</span>}
    </button>
  );
}

function loadFavoritePlanIds() {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
      || window.localStorage.getItem(FAVORITES_BACKUP_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter(id => typeof id === 'string'));
  } catch {
    return new Set<string>();
  }
}

function saveFavoritePlanIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(Array.from(ids));
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, serialized);
  if (ids.size > 0) {
    window.localStorage.setItem(FAVORITES_BACKUP_STORAGE_KEY, serialized);
  }
}

function rawPlanText(plan: SupplierPlan) {
  const raw = plan.raw || {};
  return [
    plan.name,
    plan.data_amount,
    plan.rule_desc_zh,
    plan.customer_note,
    plan.supplier_plan_name,
    raw.channel_dataplan_name,
    raw.data,
    raw.rule_desc,
    raw.special_desc
  ].filter(value => typeof value === 'string' || typeof value === 'number').join(' ').toLowerCase();
}

function getPlanTypeKeys(plan: SupplierPlan): PlanTypeFilter[] {
  const text = rawPlanText(plan);
  const isUnlimited = text.includes('吃到飽') || /unlimited|吃放題|無限/.test(text);
  const isDaily = text.includes('每日') || /daily|\/day|per day|daypass|day pass/.test(text);
  const isTotal = text.includes('總量') || /total|fixed|package/.test(text);
  const hasSpeedLimit = plan.flags.speedLimit || /128\s?kb|256\s?kb|384\s?kb|512\s?kb|1\s?mbps|3\s?mbps|5\s?mbps|10\s?mbps|limited speed|throttl/.test(text);
  const keys: PlanTypeFilter[] = [];

  if (!isUnlimited && (isTotal || !isDaily)) keys.push('metered');
  if (!isUnlimited && isDaily) keys.push('daily');
  if (isUnlimited) keys.push('unlimited');
  if (isUnlimited && hasSpeedLimit) keys.push('throttledUnlimited');
  if (isUnlimited && !hasSpeedLimit) keys.push('highSpeedUnlimited');

  return keys;
}

function getPlanGbValues(plan: SupplierPlan) {
  const text = rawPlanText(plan);
  const values = new Set<number>();
  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:gb|g\b)/gi)) {
    values.add(Number(match[1]));
  }
  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:mb|m\b)/gi)) {
    const mb = Number(match[1]);
    if (Number.isFinite(mb) && mb >= 1024) values.add(Math.round((mb / 1024) * 100) / 100);
  }
  return Array.from(values);
}

function flagSortValue(plan: SupplierPlan) {
  return [
    plan.flags.kyc,
    plan.flags.noHotspot,
    plan.flags.noGpt,
    plan.flags.noReinstall,
    plan.flags.speedLimit,
    plan.flags.terminateAfterUse
  ].filter(Boolean).length;
}

function getSortValue(plan: SupplierPlan, field: SortField) {
  switch (field) {
    case 'name':
      return `${plan.name} ${plan.validity_days.toString().padStart(3, '0')} ${plan.data_amount}`;
    case 'supplierName':
      return `${plan.supplier_plan_name} ${plan.supplier_plan_id}`;
    case 'carrier':
      return plan.carrier || '未標示';
    case 'cost':
      return plan.cost_twd;
    case 'suggestedPrice':
      return plan.suggested_price;
    case 'note':
      return `${plan.customer_note || '無特別備註'} ${plan.active_type_note || ''}`;
    case 'flags':
      return flagSortValue(plan);
    default:
      return 0;
  }
}

function compareSortValues(a: string | number, b: string | number) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'zh-Hant', { numeric: true });
}

export default function MicroesimPlansPage() {
  const [data, setData] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedCountry, setSelectedCountry] = useState('KR');
  const [search, setSearch] = useState('');
  const [search2, setSearch2] = useState('');
  const [day, setDay] = useState('');
  const [gbAmount, setGbAmount] = useState('');
  const [hideKyc, setHideKyc] = useState(false);
  const [hideNoHotspot, setHideNoHotspot] = useState(false);
  const [hideNoGpt, setHideNoGpt] = useState(false);
  const [hideNoReinstall, setHideNoReinstall] = useState(false);
  const [hkdRate, setHkdRate] = useState('4.15');
  const [usdRate, setUsdRate] = useState('32.5');
  const [markup, setMarkup] = useState('1.65');
  const [sortField, setSortField] = useState<SortField>('default');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [planTypeFilters, setPlanTypeFilters] = useState<Set<PlanTypeFilter>>(new Set());
  const [favoritePlanIds, setFavoritePlanIds] = useState<Set<string>>(loadFavoritePlanIds);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [favoritesSaving, setFavoritesSaving] = useState(false);
  const [favoritesError, setFavoritesError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [focusedPlanByGroup, setFocusedPlanByGroup] = useState<Record<string, string>>({});

  const plans = useMemo(() => data?.plans || [], [data]);
  const selectedCountryName = countryOptions.find(country => country.code === selectedCountry)?.name || '韓國';
  const syncedCountryName = data?.country?.name || selectedCountryName;

  const filteredPlans = useMemo(() => {
    const keywords = [search, search2]
      .map(value => value.trim().toLowerCase())
      .filter(Boolean);
    const filtered = plans.filter(plan => {
      if (favoritesOnly && !favoritePlanIds.has(plan.supplier_plan_id)) return false;
      const dayKeyword = day.trim();
      if (dayKeyword && String(plan.validity_days) !== dayKeyword) return false;
      const gbKeyword = Number(gbAmount.trim());
      if (gbAmount.trim() && (!Number.isFinite(gbKeyword) || !getPlanGbValues(plan).some(value => Math.abs(value - gbKeyword) < 0.01))) return false;
      if (hideKyc && plan.flags.kyc) return false;
      if (hideNoHotspot && plan.flags.noHotspot) return false;
      if (hideNoGpt && plan.flags.noGpt) return false;
      if (hideNoReinstall && plan.flags.noReinstall) return false;
      if (planTypeFilters.size > 0) {
        const planTypes = getPlanTypeKeys(plan);
        if (!planTypes.some(type => planTypeFilters.has(type))) return false;
      }
      if (keywords.length === 0) return true;
      const text = [
        plan.name,
        plan.supplier_plan_name,
        plan.data_amount,
        plan.carrier,
        plan.networks,
        plan.apn,
        plan.customer_note,
        plan.internal_warning
      ].join(' ').toLowerCase();
      return keywords.every(keyword => text.includes(keyword));
    });
    if (sortField === 'default') return [...filtered].sort((a, b) =>
      compareEsimPlanOrder(a.data_amount, b.data_amount)
      || a.validity_days - b.validity_days
      || a.name.localeCompare(b.name, 'zh-Hant', { numeric: true })
    );
    return [...filtered].sort((a, b) => {
      const result = compareSortValues(getSortValue(a, sortField), getSortValue(b, sortField));
      return sortDirection === 'asc' ? result : -result;
    });
  }, [plans, search, search2, day, gbAmount, hideKyc, hideNoHotspot, hideNoGpt, hideNoReinstall, planTypeFilters, favoritesOnly, favoritePlanIds, sortField, sortDirection]);

  const selectedPlans = plans.filter(plan => selected.has(plan.supplier_plan_id));
  const groupedPlans = useMemo<PlanGroup[]>(() => {
    const groups = new Map<string, PlanGroup>();
    for (const plan of filteredPlans) {
      const family = getPlanFamily(plan);
      const speedTier = getMicroesimPlanSpeedTier(plan);
      const key = `${family.supplierBaseName}||${family.groupCode}||${speedTier}`;
      const current = groups.get(key);
      if (current) current.plans.push(plan);
      else groups.set(key, { key, ...family, speedTier, plans: [plan] });
    }
    return Array.from(groups.values()).map(group => ({
      ...group,
      plans: [...group.plans].sort((a, b) => a.validity_days - b.validity_days || a.cost_twd - b.cost_twd)
    }));
  }, [filteredPlans]);
  const favoriteVisibleCount = plans.filter(plan => favoritePlanIds.has(plan.supplier_plan_id)).length;
  const favoriteFilteredCount = filteredPlans.filter(plan => favoritePlanIds.has(plan.supplier_plan_id)).length;
  const favoriteTotalCount = favoritePlanIds.size;

  const persistFavoritePlanIds = async (ids: Set<string>) => {
    saveFavoritePlanIds(ids);
    setFavoritesSaving(true);
    setFavoritesError('');
    try {
      const response = await adminFetch('/api/admin/microesim/favorites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planIds: Array.from(ids) })
      });
      const json = await response.json();
      if (!response.ok || json.error) throw new Error(json.error || '儲存我的最愛失敗');
    } catch (err) {
      setFavoritesError(err instanceof Error ? err.message : '儲存我的最愛失敗');
    } finally {
      setFavoritesSaving(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchFavorites = async () => {
      setFavoritesError('');
      try {
        const response = await adminFetch('/api/admin/microesim/favorites', { cache: 'no-store' });
        const json = await response.json();
        if (!response.ok || json.error) throw new Error(json.error || '讀取我的最愛失敗');
        if (cancelled) return;

        const remoteIds = Array.isArray(json.planIds)
          ? json.planIds.filter((id: unknown) => typeof id === 'string' && id.trim())
          : [];
        const localIds = loadFavoritePlanIds();
        const next = new Set([...Array.from(localIds), ...remoteIds]);
        setFavoritePlanIds(next);
        saveFavoritePlanIds(next);
        const remoteSet = new Set(remoteIds);
        const shouldBackfillRemote = next.size !== remoteSet.size || Array.from(next).some(id => !remoteSet.has(id));
        if (shouldBackfillRemote) void persistFavoritePlanIds(next);
      } catch (err) {
        if (!cancelled) setFavoritesError(err instanceof Error ? err.message : '讀取我的最愛失敗');
      } finally {
        if (!cancelled) setFavoritesLoaded(true);
      }
    };

    void fetchFavorites();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCardDay = (groupKey: string, plan: SupplierPlan) => {
    setFocusedPlanByGroup(prev => ({ ...prev, [groupKey]: plan.supplier_plan_id }));
    toggleSelected(plan.supplier_plan_id);
  };

  const toggleGroupSelected = (group: PlanGroup) => {
    setSelected(prev => {
      const next = new Set(prev);
      const allSelected = group.plans.every(plan => next.has(plan.supplier_plan_id));
      group.plans.forEach(plan => {
        if (allSelected) next.delete(plan.supplier_plan_id);
        else next.add(plan.supplier_plan_id);
      });
      return next;
    });
  };

  const toggleGroupFavorite = (group: PlanGroup) => {
    const next = new Set(favoritePlanIds);
    const allFavorite = group.plans.every(plan => next.has(plan.supplier_plan_id));
    group.plans.forEach(plan => {
      if (allFavorite) next.delete(plan.supplier_plan_id);
      else next.add(plan.supplier_plan_id);
    });
    setFavoritePlanIds(next);
    void persistFavoritePlanIds(next);
  };

  const selectFiltered = () => {
    setSelected(prev => {
      const next = new Set(prev);
      filteredPlans.forEach(plan => next.add(plan.supplier_plan_id));
      return next;
    });
  };

  const selectFavoritePlans = () => {
    setSelected(prev => {
      const next = new Set(prev);
      filteredPlans
        .filter(plan => favoritePlanIds.has(plan.supplier_plan_id))
        .forEach(plan => next.add(plan.supplier_plan_id));
      return next;
    });
  };

  const clearSelected = () => setSelected(new Set());

  const togglePlanType = (type: PlanTypeFilter) => {
    setPlanTypeFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleFavorite = (id: string) => {
    const next = new Set(favoritePlanIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFavoritePlanIds(next);
    void persistFavoritePlanIds(next);
  };

  const toggleSort = (field: Exclude<SortField, 'default'>) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortField(field);
    setSortDirection('asc');
  };

  const fetchPlans = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    setSelected(new Set());
    try {
      const params = new URLSearchParams({
        country: selectedCountry,
        hkdRate,
        usdRate,
        markup
      });
      const response = await adminFetch(`/api/admin/microesim/plans?${params.toString()}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || '同步失敗');
      setData(json);
      setMessage(`同步完成：掃描 ${json.scanned} 筆，找到${json.country?.name || selectedCountryName} ${json.plans?.length || 0} 筆`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步失敗');
    } finally {
      setLoading(false);
    }
  };

  const importSelected = async () => {
    if (selectedPlans.length === 0 || importing) return;
    if (!confirm(`即將上架 ${selectedPlans.length} 個${syncedCountryName}商品，是否確認？`)) return;

    setImporting(true);
    setError('');
    setMessage('');
    await persistFavoritePlanIds(favoritePlanIds);
    try {
      const response = await adminFetch('/api/admin/microesim/import-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans: selectedPlans })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || '上架失敗');
      setMessage(`上架完成：新增 ${json.inserted || 0} 筆，補上連結 ${json.linked || 0} 筆，跳過 ${json.skipped || 0} 筆。我的最愛保留 ${favoriteTotalCount} 筆${json.usedBasicFallback ? '。提醒：目前資料庫尚未建立供應商內部欄位，已先用基本商品欄位上架。' : ''}`);
      clearSelected();
    } catch (err) {
      setError(err instanceof Error ? err.message : '上架失敗');
    } finally {
      setImporting(false);
    }
  };

  const avgCost = plans.length ? Math.round(plans.reduce((sum, plan) => sum + plan.cost_twd, 0) / plans.length) : 0;
  const lowestCost = plans.length ? Math.min(...plans.map(plan => plan.cost_twd)) : 0;
  const riskyCount = plans.filter(plan => plan.flags.kyc || plan.flags.noGpt || plan.flags.noHotspot || plan.flags.noReinstall).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">MicroEsim 方案庫</h1>
          <p className="mt-1 text-sm text-white/45">選擇國家後同步方案；卡片會將相同名稱與分組的所有天數集中顯示，點選天數即可準備上架。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex h-10 rounded-lg border border-cyan-300/35 bg-black/25 p-1">
            <button type="button" onClick={() => setViewMode('cards')} className={`inline-flex items-center gap-1.5 rounded-md px-3 text-xs font-bold transition-colors ${viewMode === 'cards' ? 'bg-cyan-500 text-[#071317]' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}><LayoutGrid size={15} />卡片</button>
            <button type="button" onClick={() => setViewMode('table')} className={`inline-flex items-center gap-1.5 rounded-md px-3 text-xs font-bold transition-colors ${viewMode === 'table' ? 'bg-cyan-500 text-[#071317]' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}><List size={15} />表格</button>
          </div>
          <button
            onClick={fetchPlans}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
            同步{selectedCountryName}方案
          </button>
          <button
            onClick={importSelected}
            disabled={importing || selectedPlans.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            上架已選 {selectedPlans.length}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs text-white/40">{syncedCountryName}方案</p>
          <p className="mt-1 text-2xl font-bold text-white">{plans.length}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs text-white/40">最低成本</p>
          <p className="mt-1 text-2xl font-bold text-white">{money(lowestCost)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs text-white/40">平均成本</p>
          <p className="mt-1 text-2xl font-bold text-white">{money(avgCost)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs text-white/40">我的最愛 / 含限制</p>
          <p className="mt-1 text-2xl font-bold text-white">{favoriteVisibleCount}<span className="text-base text-white/35"> / {riskyCount}</span></p>
          <p className="mt-1 text-[11px] text-white/35">
            全部收藏 {favoriteTotalCount} 筆
            {favoritesSaving ? ' · 儲存中' : favoritesLoaded ? ' · 已同步' : ' · 載入中'}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white/75">
          <Filter className="h-4 w-4 text-cyan-300" />
          同步與篩選
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8">
          <label className="text-xs text-white/50">
            國家
            <select
              value={selectedCountry}
              onChange={(event) => {
                setSelectedCountry(event.target.value);
                setData(null);
                setMessage('');
                setError('');
                setPlanTypeFilters(new Set());
                clearSelected();
              }}
              className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
            >
              {countryOptions.map(country => (
                <option key={country.code} value={country.code} className="text-black">{country.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-white/50">
            HKD 匯率
            <input value={hkdRate} onChange={(event) => setHkdRate(event.target.value)} className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-white/50">
            USD 匯率
            <input value={usdRate} onChange={(event) => setUsdRate(event.target.value)} className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-white/50">
            建議售價倍率
            <input value={markup} onChange={(event) => setMarkup(event.target.value)} className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-white/50">
            天數
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={day}
              onChange={(event) => setDay(event.target.value)}
              placeholder="空白為全部"
              className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30"
            />
          </label>
          <label className="text-xs text-white/50">
            G 數
            <input
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              value={gbAmount}
              onChange={(event) => setGbAmount(event.target.value)}
              placeholder="例如 5"
              className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30"
            />
          </label>
          <label className="relative text-xs text-white/50">
            關鍵字 1
            <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-white/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="名稱、電信商、備註"
              className="mt-1 w-full rounded-md border border-white/15 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30"
            />
          </label>
          <label className="relative text-xs text-white/50">
            關鍵字 2
            <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-white/35" />
            <input
              value={search2}
              onChange={(event) => setSearch2(event.target.value)}
              placeholder="需同時符合"
              className="mt-1 w-full rounded-md border border-white/15 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/60">
          <button
            type="button"
            onClick={() => setFavoritesOnly(prev => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${
              favoritesOnly
                ? 'border-yellow-300/60 bg-yellow-400/15 text-yellow-100'
                : 'border-white/15 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-yellow-300' : ''}`} />
            只看我的最愛 {favoriteVisibleCount}/{favoriteTotalCount}
          </button>
          {planTypeOptions.map(option => {
            const isActive = planTypeFilters.has(option.key);
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => togglePlanType(option.key)}
                className={`rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${
                  isActive
                    ? 'border-cyan-300/60 bg-cyan-400/15 text-cyan-100'
                    : 'border-white/15 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            );
          })}
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={hideKyc} onChange={(event) => setHideKyc(event.target.checked)} /> 排除 KYC</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={hideNoHotspot} onChange={(event) => setHideNoHotspot(event.target.checked)} /> 排除不可熱點</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={hideNoGpt} onChange={(event) => setHideNoGpt(event.target.checked)} /> 排除不可 GPT</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={hideNoReinstall} onChange={(event) => setHideNoReinstall(event.target.checked)} /> 排除不可重複安裝</label>
          <button onClick={selectFiltered} disabled={filteredPlans.length === 0} className="ml-auto rounded-md border border-white/15 px-3 py-1.5 text-xs font-bold text-white/75 hover:bg-white/10 disabled:opacity-40">選取目前篩選 {filteredPlans.length}</button>
          <button onClick={selectFavoritePlans} disabled={favoriteFilteredCount === 0} className="rounded-md border border-yellow-300/30 px-3 py-1.5 text-xs font-bold text-yellow-100/80 hover:bg-yellow-400/10 disabled:opacity-40">選取我的最愛 {favoriteFilteredCount}</button>
          <button onClick={clearSelected} className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-bold text-white/55 hover:bg-white/10">清除選取</button>
        </div>
      </div>

      {message && <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div>}
      {error && <div className="rounded-lg border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {favoritesError && <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">我的最愛資料庫同步失敗，已先保留在本機備份：{favoritesError}</div>}

      <p className="text-sm text-white/45">卡片 {groupedPlans.length} 組，共 {filteredPlans.length} 個天數方案</p>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {loading ? (
            <div className="col-span-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-14 text-center text-white/45"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />同步中...</div>
          ) : groupedPlans.length === 0 ? (
            <div className="col-span-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-14 text-center text-white/35">尚未同步，或目前篩選沒有資料</div>
          ) : groupedPlans.map(group => {
            const focusedPlan = group.plans.find(plan => plan.supplier_plan_id === focusedPlanByGroup[group.key])
              || group.plans.find(plan => selected.has(plan.supplier_plan_id))
              || group.plans[0];
            const allFavorite = group.plans.every(plan => favoritePlanIds.has(plan.supplier_plan_id));
            const selectedCount = group.plans.filter(plan => selected.has(plan.supplier_plan_id)).length;
            const allSelected = selectedCount === group.plans.length;
            const apn = focusedPlan.apn || String(focusedPlan.raw?.apn || '').trim();
            return (
              <section key={group.key} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-white">{getPlanFamilyTitle(focusedPlan)}</h2>
                      <span className="rounded border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-100">{group.groupCode}</span>
                      {group.speedTier && <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${group.speedTier === '高速不限速' ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' : 'border-amber-300/30 bg-amber-400/10 text-amber-100'}`}>{group.speedTier}</span>}
                    </div>
                    <p className="mt-1 break-all text-xs text-white/35">{group.supplierBaseName}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => toggleGroupFavorite(group)} title={allFavorite ? '整組移除我的最愛' : '整組加入我的最愛'} className={`grid h-9 w-9 place-items-center rounded-md border ${allFavorite ? 'border-yellow-300/50 bg-yellow-400/15 text-yellow-200' : 'border-white/10 text-white/30 hover:text-yellow-200'}`}><Star size={17} className={allFavorite ? 'fill-yellow-300' : ''} /></button>
                    <button type="button" onClick={() => toggleGroupSelected(group)} title={allSelected ? '取消選取全部天數' : '選取全部天數'} aria-label={allSelected ? '取消選取全部天數' : '選取全部天數'} className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition-colors ${allSelected ? 'border-cyan-300 bg-cyan-500 text-[#071317]' : 'border-cyan-300/60 bg-cyan-400/10 text-cyan-100 hover:border-cyan-200 hover:bg-cyan-400/20'}`}><Check size={17} /><span>{allSelected ? '已全選' : '全選'}</span></button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-white/60">選擇上架天數</span><span className="text-cyan-200/70">已選 {selectedCount}/{group.plans.length}</span></div>
                  <div className="flex flex-wrap gap-2">
                    {group.plans.map(plan => {
                      const checked = selected.has(plan.supplier_plan_id);
                      const focused = plan.supplier_plan_id === focusedPlan.supplier_plan_id;
                      return <button key={plan.supplier_plan_id} type="button" onClick={() => toggleCardDay(group.key, plan)} title={`${plan.validity_days}天，成本 ${money(plan.cost_twd)}`} className={`min-w-14 rounded-md border px-3 py-2 text-sm font-bold transition-colors ${checked ? 'border-cyan-300 bg-cyan-500 text-[#071317]' : focused ? 'border-white/35 bg-white/10 text-white' : 'border-white/15 bg-black/10 text-white/55 hover:border-cyan-300/50 hover:text-white'}`}>{plan.validity_days}天</button>;
                    })}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-4 text-sm sm:grid-cols-4">
                    <div><p className="text-[11px] text-white/35">成本</p><p className="mt-0.5 font-bold text-white">{money(focusedPlan.cost_twd)}</p><p className="text-[10px] text-white/30">{focusedPlan.cost_original} {focusedPlan.cost_currency}</p></div>
                    <div><p className="text-[11px] text-white/35">建議售價</p><p className="mt-0.5 font-bold text-emerald-200">{money(focusedPlan.suggested_price)}</p><p className="text-[10px] text-white/30">毛利 {money(focusedPlan.margin_twd)}</p></div>
                    <div><p className="text-[11px] text-white/35">電信商</p><p className="mt-0.5 font-semibold text-white/75">{/local\s*iij/i.test(focusedPlan.supplier_plan_name) ? 'Docomo' : focusedPlan.carrier || '未標示'}</p></div>
                    <div><p className="text-[11px] text-white/35">APN</p><p className="mt-0.5 break-all font-mono text-white/75">{apn || '未提供'}</p></div>
                  </div>

                  <div className="mt-4 space-y-2 rounded-md bg-black/15 p-3 text-xs leading-5">
                    <p className="break-all text-white/45"><span className="text-white/30">Micro 原名稱：</span>{focusedPlan.supplier_plan_name}</p>
                    <p className="break-all font-mono text-[10px] text-white/25">ID {focusedPlan.supplier_plan_id}</p>
                    <p className="text-white/60"><span className="text-white/30">客戶備註：</span>{focusedPlan.customer_note || '無'}</p>
                    <p className="text-white/45"><span className="text-white/30">內部備註：</span>{focusedPlan.internal_warning || focusedPlan.active_type_note || '無'}</p>
                    <p className="break-all text-white/35"><span className="text-white/30">支援網路：</span>{focusedPlan.networks || '未提供'}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {yesNoBadge(focusedPlan.flags.kyc, 'KYC')}
                      {yesNoBadge(focusedPlan.flags.noHotspot, '不可熱點')}
                      {yesNoBadge(focusedPlan.flags.noGpt, '不可 GPT')}
                      {yesNoBadge(focusedPlan.flags.noReinstall, '不可重複安裝')}
                      {yesNoBadge(focusedPlan.flags.speedLimit, '限速', 'bg-amber-500/15 text-amber-100 border-amber-400/30')}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm text-white/60">顯示 {filteredPlans.length} 筆，已選 {selectedPlans.length} 筆</div>
          {data && <div className="text-xs text-white/35">掃描 {data.scanned}/{data.total} 筆，頁數 {data.totalPages}</div>}
        </div>
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full min-w-[1260px] text-sm">
            <thead className="sticky top-0 bg-[#17172a] text-xs text-white/45">
              <tr>
                <th className="w-20 px-3 py-3 text-left"></th>
                <th className="px-3 py-3 text-left">
                  <SortHeader label="一飛通商品名稱" field="name" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} />
                </th>
                <th className="px-3 py-3 text-left">
                  <SortHeader label="MicroEsim 原名稱" field="supplierName" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} />
                </th>
                <th className="px-3 py-3 text-left">
                  <SortHeader label="電信商" field="carrier" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} />
                </th>
                <th className="px-3 py-3 text-right">
                  <SortHeader label="成本" field="cost" align="right" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} />
                </th>
                <th className="px-3 py-3 text-right">
                  <SortHeader label="建議售價" field="suggestedPrice" align="right" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} />
                </th>
                <th className="px-3 py-3 text-left">
                  <SortHeader label="中文備註" field="note" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} />
                </th>
                <th className="px-3 py-3 text-left">
                  <SortHeader label="限制" field="flags" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-white/45"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />同步中...</td></tr>
              ) : filteredPlans.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-white/35">尚未同步，或目前篩選沒有資料</td></tr>
              ) : filteredPlans.map(plan => {
                const checked = selected.has(plan.supplier_plan_id);
                const isFavorite = favoritePlanIds.has(plan.supplier_plan_id);
                return (
                  <tr key={plan.supplier_plan_id} className={checked ? 'bg-cyan-400/10' : isFavorite ? 'bg-yellow-400/[0.04]' : 'hover:bg-white/[0.03]'}>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(plan.supplier_plan_id)}
                          className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                            isFavorite
                              ? 'border-yellow-300/60 bg-yellow-400/15 text-yellow-200'
                              : 'border-white/15 text-white/35 hover:border-yellow-300/50 hover:text-yellow-200'
                          }`}
                          aria-label={isFavorite ? '移除我的最愛' : '加入我的最愛'}
                          title={isFavorite ? '移除我的最愛' : '加入我的最愛'}
                        >
                          <Star className={`h-4 w-4 ${isFavorite ? 'fill-yellow-300' : ''}`} />
                        </button>
                      <button
                        onClick={() => toggleSelected(plan.supplier_plan_id)}
                        className={`flex h-6 w-6 items-center justify-center rounded-md border ${checked ? 'border-cyan-300 bg-cyan-500 text-white' : 'border-white/20 text-transparent hover:border-cyan-300'}`}
                        aria-label="選取方案"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="font-semibold text-white">{plan.name}</div>
                      <div className="mt-1 text-xs text-cyan-200/80">{plan.data_amount} · {plan.validity_days}天 · {plan.hotspot_sharing}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="text-white/70">{plan.supplier_plan_name}</div>
                      <div className="mt-1 font-mono text-[11px] text-white/30">{plan.supplier_plan_id}</div>
                    </td>
                    <td className="px-3 py-3 align-top text-white/70">
                      {plan.carrier || '未標示'}
                    </td>
                    <td className="px-3 py-3 text-right align-top">
                      <div className="font-semibold text-white">{money(plan.cost_twd)}</div>
                      <div className="text-xs text-white/35">{plan.cost_original} {plan.cost_currency}</div>
                    </td>
                    <td className="px-3 py-3 text-right align-top">
                      <div className="font-semibold text-emerald-200">{money(plan.suggested_price)}</div>
                      <div className="text-xs text-white/35">毛利 {money(plan.margin_twd)}</div>
                    </td>
                    <td className="max-w-[300px] px-3 py-3 align-top text-xs leading-5 text-white/65">
                      <div>{plan.customer_note || '無特別備註'}</div>
                      {plan.active_type_note && <div className="mt-1 text-white/35">{plan.active_type_note}</div>}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex max-w-[220px] flex-wrap gap-1.5">
                        {yesNoBadge(plan.flags.kyc, 'KYC')}
                        {yesNoBadge(plan.flags.noHotspot, '不可熱點')}
                        {yesNoBadge(plan.flags.noGpt, '不可 GPT')}
                        {yesNoBadge(plan.flags.noReinstall, '不可重複安裝')}
                        {yesNoBadge(plan.flags.speedLimit, '限速', 'bg-amber-500/15 text-amber-100 border-amber-400/30')}
                        {yesNoBadge(plan.flags.terminateAfterUse, '用完即停', 'bg-white/10 text-white/70 border-white/20')}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
