"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  Building2,
  HandCoins,
  Search,
  WalletCards,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";

interface Dealer {
  id: string;
  email: string;
  store_name: string;
  contact_name: string | null;
  phone: string | null;
  tax_id: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  price_rate_percent: number;
  balance: number;
  pricing_mode: "percentage_markup" | "fixed_markup";
  pricing_value: number;
  sales_mode: "direct" | "referral";
  referral_code: string | null;
  referral_discount_percent: number;
  referral_commission_mode: "percentage" | "fixed";
  referral_commission_value: number;
  referral_share_percent: number;
  admin_note: string | null;
  created_at: string;
}
interface TopupRequest {
  id: string;
  dealer_id: string;
  amount: number;
  note: string | null;
  status: string;
  created_at: string;
  dealers:
    | { store_name: string; email: string; balance: number }
    | { store_name: string; email: string; balance: number }[];
}
interface ReferralPayout {
  id: string;
  dealer_id: string;
  code_snapshot: string | null;
  amount: number;
  status: string;
  dealer_note: string | null;
  admin_note: string | null;
  requested_at: string;
  reviewed_at: string | null;
  paid_at: string | null;
  dealers:
    | { store_name: string; email: string }
    | { store_name: string; email: string }[];
}

const STATUS_LABELS = {
  pending: "待審核",
  approved: "已開通",
  rejected: "未通過",
  suspended: "已停用",
};
function money(value: number) {
  return `NT$${Number(value || 0).toLocaleString("zh-TW")}`;
}
function first<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AdminDealersPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [topups, setTopups] = useState<TopupRequest[]>([]);
  const [referralPayouts, setReferralPayouts] = useState<ReferralPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("全部");
  const [editing, setEditing] = useState<Dealer | null>(null);
  const [pricingMode, setPricingMode] =
    useState<Dealer["pricing_mode"]>("fixed_markup");
  const [pricingValue, setPricingValue] = useState("10");
  const [salesMode, setSalesMode] = useState<Dealer["sales_mode"]>("direct");
  const [referralCode, setReferralCode] = useState("");
  const [referralDiscountPercent, setReferralDiscountPercent] = useState("3");
  const [referralCommissionMode, setReferralCommissionMode] =
    useState<Dealer["referral_commission_mode"]>("percentage");
  const [referralCommissionValue, setReferralCommissionValue] = useState("3");
  const [referralSharePercent, setReferralSharePercent] = useState("30");
  const [adminNote, setAdminNote] = useState("");
  const [balanceDealer, setBalanceDealer] = useState<Dealer | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [balanceReason, setBalanceReason] = useState("現金加值");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await adminFetch("/api/admin/dealers", {
      cache: "no-store",
    });
    const result = await response.json();
    if (response.ok) {
      setDealers(result.dealers || []);
      setTopups(result.topupRequests || []);
      setReferralPayouts(result.referralPayouts || []);
    } else setMessage(result.error || "讀取失敗");
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(
    () =>
      dealers
        .filter((dealer) => {
          const keyword = search.trim().toLowerCase();
          return (
            (status === "全部" || dealer.status === status) &&
            (!keyword ||
              `${dealer.store_name} ${dealer.email} ${dealer.contact_name || ""} ${dealer.phone || ""}`
                .toLowerCase()
                .includes(keyword))
          );
        })
        .sort(
          (a, b) =>
            (a.status === "pending" ? -1 : 0) -
            (b.status === "pending" ? -1 : 0),
        ),
    [dealers, search, status],
  );
  const pendingTopups = topups.filter((item) => item.status === "pending");

  const updateDealer = async (
    dealer: Dealer,
    nextStatus: Dealer["status"],
    note = adminNote,
  ) => {
    setBusy(true);
    setMessage("");
    try {
      const usingForm = editing?.id === dealer.id;
      const response = await adminFetch("/api/admin/dealers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateDealer",
          dealerId: dealer.id,
          status: nextStatus,
          adminNote: note,
          pricingMode: usingForm ? pricingMode : dealer.pricing_mode,
          pricingValue: usingForm
            ? Number(pricingValue)
            : Number(dealer.pricing_value),
          salesMode: usingForm ? salesMode : dealer.sales_mode || "direct",
          referralCode: usingForm ? referralCode : dealer.referral_code || "",
          referralDiscountPercent: usingForm
            ? Number(referralDiscountPercent)
            : Number(dealer.referral_discount_percent ?? 3),
          referralCommissionMode: usingForm
            ? referralCommissionMode
            : dealer.referral_commission_mode || "percentage",
          referralCommissionValue: usingForm
            ? Number(referralCommissionValue)
            : Number(dealer.referral_commission_value ?? 3),
          referralSharePercent: usingForm
            ? Number(referralSharePercent)
            : Number(dealer.referral_share_percent ?? 30),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "更新失敗");
      setEditing(null);
      setMessage("經銷商設定已更新");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  };

  const adjustBalance = async () => {
    if (!balanceDealer) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await adminFetch("/api/admin/dealers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjustBalance",
          dealerId: balanceDealer.id,
          amount: balanceAmount,
          cashReceivedAmount: cashReceived,
          reason: balanceReason,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "調整失敗");
      setBalanceDealer(null);
      setBalanceAmount("");
      setCashReceived("");
      setMessage("經銷商餘額已更新");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "調整失敗");
    } finally {
      setBusy(false);
    }
  };

  const reviewTopup = async (
    request: TopupRequest,
    decision: "approved" | "rejected",
  ) => {
    if (
      decision === "approved" &&
      !window.confirm(`確認已收到 ${money(request.amount)} 現金並入帳？`)
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const response = await adminFetch("/api/admin/dealers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reviewTopup",
          requestId: request.id,
          decision,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "審核失敗");
      setMessage(
        decision === "approved" ? "加值已核准並入帳" : "加值申請已拒絕",
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "審核失敗");
    } finally {
      setBusy(false);
    }
  };

  const reviewReferralPayout = async (
    payout: ReferralPayout,
    decision: "paid" | "rejected",
  ) => {
    if (
      decision === "paid" &&
      !window.confirm(`確認已撥款 ${money(payout.amount)}？`)
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const response = await adminFetch("/api/admin/dealers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reviewReferralPayout",
          payoutId: payout.id,
          decision,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "處理失敗");
      setMessage(decision === "paid" ? "已標記完成撥款" : "已退回可撥款餘額");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "處理失敗");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (dealer: Dealer, approve = false) => {
    setEditing(approve ? { ...dealer, status: "approved" } : dealer);
    setPricingMode(dealer.pricing_mode || "fixed_markup");
    setPricingValue(String(dealer.pricing_value ?? 10));
    setSalesMode(dealer.sales_mode || "direct");
    setReferralCode(dealer.referral_code || "");
    setReferralDiscountPercent(String(dealer.referral_discount_percent ?? 3));
    setReferralCommissionMode(dealer.referral_commission_mode || "percentage");
    setReferralCommissionValue(String(dealer.referral_commission_value ?? 3));
    setReferralSharePercent(String(dealer.referral_share_percent ?? 30));
    setAdminNote(dealer.admin_note || "");
  };
  const pricingDescription = (dealer: Dealer) =>
    dealer.pricing_mode === "percentage_markup"
      ? `成本＋${Number(dealer.pricing_value || 0).toLocaleString("zh-TW")}%`
      : `成本＋${money(Number(dealer.pricing_value ?? 10))}`;
  const openBalance = (dealer: Dealer) => {
    setBalanceDealer(dealer);
    setBalanceAmount("");
    setCashReceived("");
    setBalanceReason("現金加值");
  };
  const pendingReferralPayouts = referralPayouts.filter(
    (item) => item.status === "requested",
  );

  return (
    <div className="mx-auto max-w-7xl pb-20">
      <div className="mb-7">
        <h1 className="text-2xl font-black">經銷商專區</h1>
        <p className="mt-1 text-sm text-white/45">
          審核帳號、設定每家經銷計價方式、現金加值與帳戶狀態
        </p>
      </div>
      {message && (
        <div className="mb-5 border-l-2 border-cyan bg-white/5 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {pendingTopups.length > 0 && (
        <section className="mb-9">
          <div className="mb-3 flex items-center gap-2">
            <Banknote className="text-amber-300" size={21} />
            <h2 className="text-lg font-bold">待核准現金加值</h2>
            <span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-black text-black">
              {pendingTopups.length}
            </span>
          </div>
          <div className="divide-y divide-white/8 border-y border-white/10">
            {pendingTopups.map((request) => {
              const dealer = first(request.dealers);
              return (
                <div
                  key={request.id}
                  className="grid gap-3 py-4 md:grid-cols-[1fr_150px_1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-semibold">{dealer?.store_name}</p>
                    <p className="text-sm text-white/40">{dealer?.email}</p>
                  </div>
                  <p className="text-lg font-black text-amber-300">
                    {money(request.amount)}
                  </p>
                  <div>
                    <p className="text-sm">{request.note || "無備註"}</p>
                    <p className="text-xs text-white/35">
                      {new Date(request.created_at).toLocaleString("zh-TW")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => reviewTopup(request, "approved")}
                      className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-black text-black"
                    >
                      確認收款
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => reviewTopup(request, "rejected")}
                      className="rounded-md border border-white/15 px-3 py-2 text-sm"
                    >
                      拒絕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {pendingReferralPayouts.length > 0 && (
        <section className="mb-9">
          <div className="mb-3 flex items-center gap-2">
            <HandCoins className="text-emerald-300" size={21} />
            <h2 className="text-lg font-bold">待處理推薦分潤撥款</h2>
            <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-xs font-black text-black">
              {pendingReferralPayouts.length}
            </span>
          </div>
          <div className="divide-y divide-white/8 border-y border-white/10">
            {pendingReferralPayouts.map((payout) => {
              const dealer = first(payout.dealers);
              return (
                <div
                  key={payout.id}
                  className="grid gap-3 py-4 md:grid-cols-[1fr_150px_1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-semibold">{dealer?.store_name}</p>
                    <p className="text-sm text-white/40">{dealer?.email}</p>
                    <p className="mt-1 font-mono text-xs text-emerald-300">
                      推薦碼：{payout.code_snapshot || "舊制未記錄"}
                    </p>
                  </div>
                  <p className="text-lg font-black text-emerald-300">
                    {money(payout.amount)}
                  </p>
                  <div>
                    <p className="text-sm">{payout.dealer_note || "無備註"}</p>
                    <p className="text-xs text-white/35">
                      {new Date(payout.requested_at).toLocaleString("zh-TW")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => reviewReferralPayout(payout, "paid")}
                      className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-black text-black"
                    >
                      確認已撥款
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => reviewReferralPayout(payout, "rejected")}
                      className="rounded-md border border-white/15 px-3 py-2 text-sm"
                    >
                      退回
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-9">
        <div className="mb-3 flex items-center gap-2">
          <WalletCards className="text-cyan" size={21} />
          <h2 className="text-lg font-bold">推薦分潤撥款紀錄</h2>
        </div>
        <div className="divide-y divide-white/8 border-y border-white/10">
          {referralPayouts.length ? (
            referralPayouts.map((payout) => {
              const dealer = first(payout.dealers);
              const payoutStatus =
                payout.status === "paid"
                  ? "已完成撥款"
                  : payout.status === "requested"
                    ? "待處理"
                    : payout.status === "rejected"
                      ? "已退回"
                      : "已取消";
              return (
                <div
                  key={payout.id}
                  className="grid gap-3 py-4 md:grid-cols-[1fr_150px_130px_1fr] md:items-center"
                >
                  <div>
                    <p className="font-semibold">{dealer?.store_name}</p>
                    <p className="text-xs text-white/40">{dealer?.email}</p>
                    <p className="mt-1 font-mono text-xs text-emerald-300">
                      {payout.code_snapshot || "舊制未記錄推薦碼"}
                    </p>
                  </div>
                  <p className="font-black text-emerald-300">
                    {money(payout.amount)}
                  </p>
                  <p
                    className={`text-sm font-bold ${payout.status === "paid" ? "text-emerald-300" : payout.status === "requested" ? "text-amber-200" : "text-white/45"}`}
                  >
                    {payoutStatus}
                  </p>
                  <div className="text-xs leading-5 text-white/40">
                    <p>
                      申請：
                      {new Date(payout.requested_at).toLocaleString("zh-TW")}
                    </p>
                    {payout.paid_at && (
                      <p>
                        撥款：{new Date(payout.paid_at).toLocaleString("zh-TW")}
                      </p>
                    )}
                    <p>{payout.admin_note || payout.dealer_note || "無備註"}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-10 text-center text-white/35">
              尚無推薦分潤撥款紀錄
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Search
              className="absolute left-3 top-3.5 text-white/30"
              size={18}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field pl-10"
              placeholder="搜尋店家、Email、電話"
            />
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="field sm:w-44"
          >
            <option>全部</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="divide-y divide-white/8 border-y border-white/10">
          {loading ? (
            <p className="py-16 text-center text-white/35">載入中...</p>
          ) : filtered.length ? (
            filtered.map((dealer) => (
              <article
                key={dealer.id}
                className="grid gap-4 py-5 lg:grid-cols-[minmax(220px,1fr)_140px_190px_150px_auto] lg:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-cyan" />
                    <p className="font-bold">{dealer.store_name}</p>
                  </div>
                  <p className="mt-1 text-sm text-white/45">{dealer.email}</p>
                  <p className="text-xs text-white/30">
                    {dealer.contact_name || "-"} · {dealer.phone || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/35">帳號狀態</p>
                  <p
                    className={`mt-1 font-semibold ${dealer.status === "approved" ? "text-emerald-300" : dealer.status === "pending" ? "text-amber-300" : "text-rose-300"}`}
                  >
                    {STATUS_LABELS[dealer.status]}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/35">合作模式</p>
                  <p className="mt-1 font-black">
                    {dealer.sales_mode === "referral"
                      ? `推薦碼 ${dealer.referral_code || "未設定"}`
                      : pricingDescription(dealer)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/35">
                    {dealer.sales_mode === "referral"
                      ? "可分配總比例"
                      : "可用餘額"}
                  </p>
                  <p
                    className={`mt-1 font-black ${dealer.sales_mode === "referral" ? "text-emerald-300" : "text-amber-300"}`}
                  >
                    {dealer.sales_mode === "referral"
                      ? `${Number(dealer.referral_share_percent || 0)}%`
                      : money(dealer.balance)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {dealer.status === "pending" && (
                    <>
                      <button
                        onClick={() => openEdit(dealer, true)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-400 px-3 py-2 text-sm font-black text-black"
                      >
                        <BadgeCheck size={16} />
                        設定並開通
                      </button>
                      <button
                        onClick={() =>
                          void updateDealer(
                            dealer,
                            "rejected",
                            dealer.admin_note || "",
                          )
                        }
                        className="rounded-md border border-rose-400/30 px-3 py-2 text-sm text-rose-300"
                      >
                        拒絕
                      </button>
                    </>
                  )}
                  {dealer.sales_mode !== "referral" && (
                    <button
                      onClick={() => openBalance(dealer)}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-300/25 px-3 py-2 text-sm font-black text-amber-200"
                    >
                      <WalletCards size={16} />
                      餘額
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(dealer)}
                    className="rounded-md border border-cyan/25 bg-cyan/5 px-3 py-2 text-sm font-bold text-cyan"
                  >
                    合作設定
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="py-16 text-center text-white/35">
              沒有符合條件的經銷商
            </p>
          )}
        </div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4">
          <div className="my-6 w-full max-w-md rounded-md border border-white/12 bg-[#17172a] p-6">
            <h2 className="text-xl font-black">店家合作設定</h2>
            <p className="mt-1 text-sm text-white/40">{editing.store_name}</p>
            <label className="mt-6 block text-sm text-white/50">
              合作模式
              <select
                value={salesMode}
                onChange={(e) =>
                  setSalesMode(e.target.value as Dealer["sales_mode"])
                }
                className="field mt-2"
              >
                <option value="direct">經銷模式（後台代客販售）</option>
                <option value="referral">推薦碼模式（官網前台成交分潤）</option>
              </select>
            </label>
            {salesMode === "direct" ? (
              <>
                <label className="mt-4 block text-sm text-white/50">
                  經銷計價方式
                  <select
                    value={pricingMode}
                    onChange={(e) =>
                      setPricingMode(e.target.value as Dealer["pricing_mode"])
                    }
                    className="field mt-2"
                  >
                    <option value="percentage_markup">成本加成百分比</option>
                    <option value="fixed_markup">成本加固定金額</option>
                  </select>
                </label>
                <label className="mt-4 block text-sm text-white/50">
                  {pricingMode === "percentage_markup"
                    ? "加成比例（%）"
                    : "每張固定加價（NT$）"}
                  <input
                    type="number"
                    min="0"
                    max={pricingMode === "percentage_markup" ? 500 : 100000}
                    step="0.01"
                    value={pricingValue}
                    onChange={(e) => setPricingValue(e.target.value)}
                    className="field mt-2"
                  />
                </label>
                <p className="mt-2 text-xs text-cyan">
                  預覽：
                  {pricingMode === "percentage_markup"
                    ? `商品成本＋${Number(pricingValue || 0).toLocaleString("zh-TW")}%`
                    : `商品成本＋${money(Number(pricingValue || 0))}`}
                </p>
              </>
            ) : (
              <>
                <label className="mt-4 block text-sm text-white/50">
                  初始推薦碼
                  <input
                    value={referralCode}
                    onChange={(e) =>
                      setReferralCode(e.target.value.toUpperCase())
                    }
                    maxLength={24}
                    className="field mt-2"
                    placeholder="例如 TRAVEL88"
                  />
                </label>
                <label className="mt-4 block text-sm text-white/50">
                  可分配總比例（最高 30%）
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.01"
                    value={referralSharePercent}
                    onChange={(e) => setReferralSharePercent(e.target.value)}
                    className="field mt-2"
                  />
                </label>
                <p className="mt-2 text-xs leading-5 text-emerald-300">
                  推薦夥伴可自行分配成客戶折扣與本人分潤，例如 5%＋25%。
                </p>
              </>
            )}
            <label className="mt-4 block text-sm text-white/50">
              內部備註
              <textarea
                rows={3}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="field mt-2 py-3"
              />
            </label>
            <label className="mt-4 block text-sm text-white/50">
              帳號狀態
              <select
                value={editing.status}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    status: e.target.value as Dealer["status"],
                  })
                }
                className="field mt-2"
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-md border border-white/15 px-4 py-2"
              >
                取消
              </button>
              <button
                disabled={busy}
                onClick={() => updateDealer(editing, editing.status)}
                className="rounded-md bg-cyan px-4 py-2 font-black text-black"
              >
                儲存設定
              </button>
            </div>
          </div>
        </div>
      )}

      {balanceDealer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-md border border-white/12 bg-[#17172a] p-6">
            <h2 className="text-xl font-black">調整經銷餘額</h2>
            <p className="mt-1 text-sm text-white/40">
              {balanceDealer.store_name} · 目前 {money(balanceDealer.balance)}
            </p>
            <label className="mt-6 block text-sm text-white/50">
              加減金額
              <input
                type="number"
                value={balanceAmount}
                onChange={(e) => {
                  setBalanceAmount(e.target.value);
                  if (Number(e.target.value) > 0)
                    setCashReceived(e.target.value);
                }}
                className="field mt-2"
                placeholder="加值輸入正數，扣除輸入負數"
              />
            </label>
            <label className="mt-4 block text-sm text-white/50">
              實際收到現金
              <input
                type="number"
                min="0"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="field mt-2"
              />
            </label>
            <label className="mt-4 block text-sm text-white/50">
              原因
              <input
                value={balanceReason}
                onChange={(e) => setBalanceReason(e.target.value)}
                className="field mt-2"
              />
            </label>
            <p className="mt-3 text-xs text-white/35">
              現金收入會記在經銷商加值帳本；經銷商使用餘額購買時不重複列入收入。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setBalanceDealer(null)}
                className="rounded-md border border-white/15 px-4 py-2"
              >
                取消
              </button>
              <button
                disabled={busy}
                onClick={adjustBalance}
                className="rounded-md bg-amber-300 px-4 py-2 font-black text-black"
              >
                確認調整
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
