'use client';

import { useMemo, useState } from 'react';
import { ArrowDownUp, Check, DownloadCloud, Filter, Loader2, Search, UploadCloud } from 'lucide-react';

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

const dayOptions = ['全部', '1', '3', '5', '7', '10', '15', '30'];
type SortField = 'default' | 'cost' | 'carrier';
type SortDirection = 'asc' | 'desc';
type PlanTypeFilter = 'metered' | 'daily' | 'unlimited' | 'throttledUnlimited' | 'highSpeedUnlimited';

const planTypeOptions: { key: PlanTypeFilter; label: string }[] = [
  { key: 'metered', label: '計量型' },
  { key: 'daily', label: '記日型' },
  { key: 'unlimited', label: '吃到飽' },
  { key: 'throttledUnlimited', label: '限速吃到飽' },
  { key: 'highSpeedUnlimited', label: '高速吃到飽' }
];

function money(value: number) {
  return `NT$${Math.round(value || 0).toLocaleString('zh-TW')}`;
}

function yesNoBadge(active: boolean, label: string, activeClass = 'bg-red-500/15 text-red-200 border-red-400/30') {
  if (!active) return null;
  return <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] ${activeClass}`}>{label}</span>;
}

function getPlanTypeKeys(plan: SupplierPlan): PlanTypeFilter[] {
  const text = `${plan.name} ${plan.data_amount} ${plan.rule_desc_zh} ${plan.customer_note}`.toLowerCase();
  const isUnlimited = text.includes('吃到飽') || text.includes('unlimited');
  const isDaily = text.includes('每日') || /daily|\/day/.test(text);
  const hasSpeedLimit = plan.flags.speedLimit || /128kb|256kb|512kb|1mbps|3mbps|5mbps|10mbps/.test(text);
  const keys: PlanTypeFilter[] = [];

  if (!isUnlimited && !isDaily) keys.push('metered');
  if (!isUnlimited && isDaily) keys.push('daily');
  if (isUnlimited) keys.push('unlimited');
  if (isUnlimited && hasSpeedLimit) keys.push('throttledUnlimited');
  if (isUnlimited && !hasSpeedLimit) keys.push('highSpeedUnlimited');

  return keys;
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
  const [day, setDay] = useState('全部');
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

  const plans = useMemo(() => data?.plans || [], [data]);
  const selectedCountryName = countryOptions.find(country => country.code === selectedCountry)?.name || '韓國';
  const syncedCountryName = data?.country?.name || selectedCountryName;

  const filteredPlans = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = plans.filter(plan => {
      if (day !== '全部' && String(plan.validity_days) !== day) return false;
      if (hideKyc && plan.flags.kyc) return false;
      if (hideNoHotspot && plan.flags.noHotspot) return false;
      if (hideNoGpt && plan.flags.noGpt) return false;
      if (hideNoReinstall && plan.flags.noReinstall) return false;
      if (planTypeFilters.size > 0) {
        const planTypes = getPlanTypeKeys(plan);
        if (!planTypes.some(type => planTypeFilters.has(type))) return false;
      }
      if (!keyword) return true;
      const text = [
        plan.name,
        plan.supplier_plan_name,
        plan.data_amount,
        plan.carrier,
        plan.networks,
        plan.customer_note,
        plan.internal_warning
      ].join(' ').toLowerCase();
      return text.includes(keyword);
    });
    if (sortField === 'default') return filtered;
    return [...filtered].sort((a, b) => {
      const result = sortField === 'carrier'
        ? (a.carrier || '未標示').localeCompare(b.carrier || '未標示', 'zh-Hant')
        : a.cost_twd - b.cost_twd;
      return sortDirection === 'asc' ? result : -result;
    });
  }, [plans, search, day, hideKyc, hideNoHotspot, hideNoGpt, hideNoReinstall, planTypeFilters, sortField, sortDirection]);

  const selectedPlans = plans.filter(plan => selected.has(plan.supplier_plan_id));

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectFiltered = () => {
    setSelected(prev => {
      const next = new Set(prev);
      filteredPlans.forEach(plan => next.add(plan.supplier_plan_id));
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
      const response = await fetch(`/api/admin/microesim/plans?${params.toString()}`, { cache: 'no-store' });
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
    try {
      const response = await fetch('/api/admin/microesim/import-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans: selectedPlans })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || '上架失敗');
      setMessage(`上架完成：新增 ${json.inserted || 0} 筆，跳過 ${json.skipped || 0} 筆${json.usedBasicFallback ? '。提醒：目前資料庫尚未建立供應商內部欄位，已先用基本商品欄位上架。' : ''}`);
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
          <p className="mt-1 text-sm text-white/45">選擇國家後同步方案，轉成一飛通商品名稱與中文注意事項，再勾選一鍵上架。</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <p className="text-xs text-white/40">含限制備註</p>
          <p className="mt-1 text-2xl font-bold text-white">{riskyCount}</p>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white/75">
          <Filter className="h-4 w-4 text-cyan-300" />
          同步與篩選
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
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
            <select value={day} onChange={(event) => setDay(event.target.value)} className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white">
              {dayOptions.map(option => <option key={option} value={option} className="text-black">{option}</option>)}
            </select>
          </label>
          <label className="relative text-xs text-white/50 xl:col-span-2">
            搜尋
            <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-white/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="名稱、電信商、備註"
              className="mt-1 w-full rounded-md border border-white/15 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/60">
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
          <button onClick={selectFiltered} disabled={filteredPlans.length === 0} className="ml-auto rounded-md border border-white/15 px-3 py-1.5 text-xs font-bold text-white/75 hover:bg-white/10 disabled:opacity-40">勾選目前篩選 {filteredPlans.length}</button>
          <button onClick={clearSelected} className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-bold text-white/55 hover:bg-white/10">清除勾選</button>
        </div>
      </div>

      {message && <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div>}
      {error && <div className="rounded-lg border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm text-white/60">顯示 {filteredPlans.length} 筆，已選 {selectedPlans.length} 筆</div>
          {data && <div className="text-xs text-white/35">掃描 {data.scanned}/{data.total} 筆，頁數 {data.totalPages}</div>}
        </div>
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full min-w-[1260px] text-sm">
            <thead className="sticky top-0 bg-[#17172a] text-xs text-white/45">
              <tr>
                <th className="w-10 px-3 py-3 text-left"></th>
                <th className="px-3 py-3 text-left">一飛通商品名稱</th>
                <th className="px-3 py-3 text-left">MicroEsim 原名稱</th>
                <th className="px-3 py-3 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort('carrier')}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    電信商
                    <ArrowDownUp className="h-3.5 w-3.5" />
                    {sortField === 'carrier' && <span className="text-cyan-200">{sortDirection === 'asc' ? 'A-Z' : 'Z-A'}</span>}
                  </button>
                </th>
                <th className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('cost')}
                    className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    成本
                    <ArrowDownUp className="h-3.5 w-3.5" />
                    {sortField === 'cost' && sortDirection === 'asc' && <span className="text-cyan-200">低到高</span>}
                    {sortField === 'cost' && sortDirection === 'desc' && <span className="text-cyan-200">高到低</span>}
                  </button>
                </th>
                <th className="px-3 py-3 text-right">建議售價</th>
                <th className="px-3 py-3 text-left">中文備註</th>
                <th className="px-3 py-3 text-left">限制</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-white/45"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />同步中...</td></tr>
              ) : filteredPlans.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-white/35">尚未同步，或目前篩選沒有資料</td></tr>
              ) : filteredPlans.map(plan => {
                const checked = selected.has(plan.supplier_plan_id);
                return (
                  <tr key={plan.supplier_plan_id} className={checked ? 'bg-cyan-400/10' : 'hover:bg-white/[0.03]'}>
                    <td className="px-3 py-3 align-top">
                      <button
                        onClick={() => toggleSelected(plan.supplier_plan_id)}
                        className={`flex h-6 w-6 items-center justify-center rounded-md border ${checked ? 'border-cyan-300 bg-cyan-500 text-white' : 'border-white/20 text-transparent hover:border-cyan-300'}`}
                        aria-label="選取方案"
                      >
                        <Check className="h-4 w-4" />
                      </button>
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
    </div>
  );
}
