"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Copy,
  HandCoins,
  LogOut,
  Mail,
  Minus,
  Plus,
  RefreshCw,
  Send,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { getEsimCountryInfo } from "@/lib/esim-country-info";
import type { DealerSalesMode } from "@/lib/dealer-sales-mode";

interface Dealer {
  id: string;
  email: string;
  store_name: string;
  contact_name: string | null;
  phone: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  balance: number;
  sales_mode: "direct" | "referral";
  referral_code: string | null;
  referral_discount_percent: number;
  referral_share_percent: number;
}
interface Product {
  id: string;
  name: string;
  country: string;
  description: string | null;
  data_amount: string | null;
  validity_days: number;
  retail_price: number;
  dealer_price?: number;
  commission_amount?: number;
}
interface DealerOrder {
  id: string;
  customer_email: string;
  dealer_total: number;
  created_at: string;
  orders:
    | { order_number: string; order_status: string; payment_status: string }
    | { order_number: string; order_status: string; payment_status: string }[];
  dealer_order_items: Array<{
    id: string;
    delivery_email_status: string;
    delivery_email_error: string | null;
    products:
      | { name: string; country: string; validity_days: number }
      | { name: string; country: string; validity_days: number }[];
    order_items:
      | {
          inventory_id: string | null;
          supplier_status: string | null;
          e_sim_inventory:
            | {
                iccid: string | null;
                microesim_usage_cache: { status?: string } | null;
                microesim_usage_checked_at: string | null;
              }
            | {
                iccid: string | null;
                microesim_usage_cache: { status?: string } | null;
                microesim_usage_checked_at: string | null;
              }[];
        }
      | {
          inventory_id: string | null;
          supplier_status: string | null;
          e_sim_inventory:
            | {
                iccid: string | null;
                microesim_usage_cache: { status?: string } | null;
                microesim_usage_checked_at: string | null;
              }
            | {
                iccid: string | null;
                microesim_usage_cache: { status?: string } | null;
                microesim_usage_checked_at: string | null;
              }[];
        }[];
  }>;
}
interface Transaction {
  id: string;
  amount: number;
  balance_after: number;
  reason: string;
  created_at: string;
}
interface ReferralCommission {
  id: string;
  code_snapshot: string;
  original_amount: number;
  paid_amount: number;
  item_count: number;
  commission_amount: number;
  status: "pending" | "available" | "requested" | "paid" | "cancelled";
  created_at: string;
  orders:
    | { order_number: string; payment_status: string; order_status: string }
    | { order_number: string; payment_status: string; order_status: string }[];
}
interface DealerReferralCode {
  id: string;
  code: string;
  is_active: boolean;
  customer_discount_percent: number;
  owner_commission_percent: number;
  created_at: string;
}
interface ReferralPayout {
  id: string;
  code_snapshot: string | null;
  amount: number;
  status: string;
  dealer_note: string | null;
  admin_note: string | null;
  requested_at: string;
  paid_at: string | null;
}
interface ReferralSummary {
  totalOrders: number;
  pendingAmount: number;
  availableAmount: number;
  requestedAmount: number;
  paidAmount: number;
}

const APPLICATION_KEY = "firstroamlink-dealer-application";

interface DealerApplication {
  storeName: string;
  contactName: string;
  phone: string;
  taxId: string;
  salesMode: DealerSalesMode;
  referralCode: string;
}

function money(value: number | undefined) {
  return `NT$${Number(value || 0).toLocaleString("zh-TW")}`;
}
function first<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value;
}
function installStatus(item: DealerOrder["dealer_order_items"][number]) {
  const orderItem = first(item.order_items);
  const inventory = orderItem ? first(orderItem.e_sim_inventory) : null;
  if (!orderItem?.inventory_id) return "eSIM 準備中";
  return inventory?.microesim_usage_cache?.status || "尚未安裝";
}
function summarizeReferrals(
  commissions: ReferralCommission[],
  code = "",
): ReferralSummary {
  const rows = code
    ? commissions.filter((item) => item.code_snapshot === code)
    : commissions;
  const amountFor = (status: ReferralCommission["status"]) =>
    rows
      .filter((item) => item.status === status)
      .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
  return {
    totalOrders: rows.filter((item) => item.status !== "cancelled").length,
    pendingAmount: amountFor("pending"),
    availableAmount: amountFor("available"),
    requestedAmount: amountFor("requested"),
    paidAmount: amountFor("paid"),
  };
}

export default function DealerPage() {
  const [checking, setChecking] = useState(true);
  const [sessionEmail, setSessionEmail] = useState("");
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<DealerOrder[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [referralCommissions, setReferralCommissions] = useState<
    ReferralCommission[]
  >([]);
  const [referralPayouts, setReferralPayouts] = useState<ReferralPayout[]>([]);
  const [referralCodes, setReferralCodes] = useState<DealerReferralCode[]>([]);
  const [selectedReferralCode, setSelectedReferralCode] = useState("");
  const [view, setView] = useState<"sale" | "orders" | "balance">("sale");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [application, setApplication] = useState<DealerApplication>({
    storeName: "",
    contactName: "",
    phone: "",
    taxId: "",
    salesMode: "direct",
    referralCode: "",
  });
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [topupAmount, setTopupAmount] = useState("");
  const [topupNote, setTopupNote] = useState("");
  const [orderEmails, setOrderEmails] = useState<Record<string, string>>({});
  const [sendingOrderId, setSendingOrderId] = useState("");
  const [referralCodeDraft, setReferralCodeDraft] = useState("");
  const [newCodeCustomerDiscount, setNewCodeCustomerDiscount] = useState("5");
  const [newCodeOwnerCommission, setNewCodeOwnerCommission] = useState("25");
  const [payoutNote, setPayoutNote] = useState("");
  const customerEmailRef = useRef<HTMLInputElement>(null);
  const salesCatalogRef = useRef<HTMLElement>(null);
  const loadOrders = useCallback(async () => {
    const response = await authenticatedFetch("/api/dealer/orders", {
      cache: "no-store",
    });
    const result = await response.json();
    if (response.ok) setOrders(result.orders || []);
  }, []);

  const loadReferrals = useCallback(async () => {
    const response = await authenticatedFetch("/api/dealer/referrals", {
      cache: "no-store",
    });
    const result = await response.json();
    if (response.ok) {
      const nextCodes: DealerReferralCode[] = result.codes || [];
      setReferralCodes(nextCodes);
      setSelectedReferralCode((current) =>
        nextCodes.some((item) => item.code === current)
          ? current
          : nextCodes[0]?.code || "",
      );
      setReferralCommissions(result.commissions || []);
      setReferralPayouts(result.payouts || []);
    }
  }, []);

  const loadAccount = useCallback(async () => {
    setChecking(true);
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    setSessionEmail(session?.user.email || "");
    if (!session) {
      setDealer(null);
      setChecking(false);
      return;
    }
    const response = await authenticatedFetch("/api/dealer/profile", {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "讀取帳號失敗");
      setChecking(false);
      return;
    }
    setDealer(result.dealer || null);
    setReferralCodeDraft("");
    const allowedShare = Math.min(
      30,
      Math.max(0, Number(result.dealer?.referral_share_percent) || 0),
    );
    const suggestedDiscount = Math.min(5, allowedShare);
    setNewCodeCustomerDiscount(String(suggestedDiscount));
    setNewCodeOwnerCommission(
      String(Math.max(0, allowedShare - suggestedDiscount)),
    );
    setTransactions(result.transactions || []);
    if (result.dealer?.status === "approved") {
      const productResponse = await authenticatedFetch("/api/dealer/products", {
        cache: "no-store",
      });
      const productResult = await productResponse.json();
      if (productResponse.ok) setProducts(productResult.products || []);
      if (result.dealer?.sales_mode === "referral") await loadReferrals();
      else await loadOrders();
    }
    setChecking(false);
  }, [loadOrders, loadReferrals]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAccount();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAccount]);

  useEffect(() => {
    if (view !== "orders" || dealer?.status !== "approved") return;
    const refreshOrders = () => {
      if (dealer.sales_mode === "referral") void loadReferrals();
      else void loadOrders();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshOrders();
    };
    refreshOrders();
    window.addEventListener("focus", refreshOrders);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshOrders);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dealer?.sales_mode, dealer?.status, loadOrders, loadReferrals, view]);

  const submitApplication = async (
    form: Partial<DealerApplication> = application,
  ) => {
    const normalizedForm = {
      ...form,
      salesMode: form.salesMode === "referral" ? "referral" : "direct",
    };
    const response = await authenticatedFetch("/api/dealer/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedForm),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "送出申請失敗");
    localStorage.removeItem(APPLICATION_KEY);
    setDealer(result.dealer);
    setMessage("申請已送出，待後台審核開通");
  };

  const checkReferralCodeAvailability = async () => {
    if (application.salesMode !== "referral") return;
    const response = await fetch("/api/dealer/referral-code-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: application.referralCode }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "推薦碼檢查失敗");
  };

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (authMode === "register") {
        if (
          !application.storeName ||
          !application.contactName ||
          !application.phone ||
          (application.salesMode === "referral" &&
            !application.referralCode.trim())
        )
          throw new Error(
            application.salesMode === "referral"
              ? "請填寫完整店家資料與推薦碼"
              : "請填寫完整店家資料",
          );
        await checkReferralCodeAvailability();
        const result = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        const isExistingAccountError =
          result.error?.code === "user_already_exists" ||
          /already (registered|exists)/i.test(result.error?.message || "");
        if (result.error && !isExistingAccountError) throw result.error;
        const isExistingMember =
          isExistingAccountError || result.data.user?.identities?.length === 0;
        if (isExistingMember) {
          const signIn = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (signIn.error)
            throw new Error(
              "這個 Email 已是一般會員，請輸入原會員密碼後再送出申請",
            );
          await submitApplication();
        } else if (result.data.session) {
          await submitApplication();
        } else {
          localStorage.setItem(APPLICATION_KEY, JSON.stringify(application));
          setMessage("註冊完成，請先到信箱完成驗證，再回來登入送出經銷商申請");
        }
      } else {
        const result = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (result.error) throw result.error;
        const saved = localStorage.getItem(APPLICATION_KEY);
        if (saved) await submitApplication(JSON.parse(saved));
        await loadAccount();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  };

  const sendExistingMemberApplication = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await submitApplication();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "送出失敗");
    } finally {
      setBusy(false);
    }
  };

  const countries = useMemo(
    () =>
      Array.from(new Set(products.map((item) => item.country))).sort((a, b) =>
        a.localeCompare(b, "zh-TW"),
      ),
    [products],
  );
  const availableDays = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .filter((product) => product.country === selectedCountry)
            .map((product) => product.validity_days),
        ),
      ).sort((a, b) => a - b),
    [products, selectedCountry],
  );
  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.country === selectedCountry &&
          product.validity_days === selectedDays,
      ),
    [products, selectedCountry, selectedDays],
  );
  const cartItems = products
    .filter((product) => cart[product.id])
    .map((product) => ({ ...product, quantity: cart[product.id] }));
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + Number(item.dealer_price || 0) * item.quantity,
    0,
  );

  const showCatalogTop = () =>
    window.requestAnimationFrame(() => {
      salesCatalogRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

  const chooseCountry = (countryName: string) => {
    setSelectedCountry(countryName);
    setSelectedDays(null);
    showCatalogTop();
  };

  const returnToCountries = () => {
    setSelectedCountry("");
    setSelectedDays(null);
    showCatalogTop();
  };

  const changeQuantity = (id: string, delta: number) =>
    setCart((current) => {
      const quantity = Math.max(0, Math.min(20, (current[id] || 0) + delta));
      const next = { ...current };
      if (quantity) next[id] = quantity;
      else delete next[id];
      return next;
    });

  const createOrder = async () => {
    const productIds = cartItems.flatMap((item) =>
      Array(item.quantity).fill(item.id),
    );
    if (!productIds.length) return setMessage("請先選擇商品");
    setBusy(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/dealer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerEmail, customerName, productIds }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "下單失敗");
      setCart({});
      setCustomerEmail("");
      setCustomerName("");
      setDealer((current) =>
        current ? { ...current, balance: result.newBalance } : current,
      );
      setMessage(
        `訂單 ${result.orderNumber} 已建立${result.pendingCount ? "，eSIM 完成後會自動寄出" : "，安裝資料已寄給客戶"}`,
      );
      await Promise.all([loadOrders(), loadAccount()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "下單失敗");
    } finally {
      setBusy(false);
    }
  };

  const handleOrderAction = () => {
    if (!customerEmail.trim()) {
      setMessage("請先填寫客戶 Email，eSIM 安裝資料會寄到這個信箱");
      customerEmailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      window.setTimeout(() => customerEmailRef.current?.focus(), 350);
      return;
    }
    void createOrder();
  };

  const resendOrderEmail = async (order: DealerOrder) => {
    const nextEmail = (orderEmails[order.id] ?? order.customer_email).trim();
    setSendingOrderId(order.id);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/dealer/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealerOrderId: order.id,
          customerEmail: nextEmail,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "再次寄送失敗");
      setMessage(
        result.sentCount
          ? `已更新 Email，並重新寄送 ${result.sentCount} 封 eSIM 安裝信`
          : "已更新 Email，eSIM 配發完成後會自動寄送",
      );
      setOrderEmails((current) => ({ ...current, [order.id]: nextEmail }));
      await loadOrders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "再次寄送失敗");
      await loadOrders();
    } finally {
      setSendingOrderId("");
    }
  };

  const requestTopup = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/dealer/topups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: topupAmount, note: topupNote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "申請失敗");
      setTopupAmount("");
      setTopupNote("");
      setMessage("加值申請已送出，收到現金並核准後會顯示在餘額中");
      await loadAccount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "申請失敗");
    } finally {
      setBusy(false);
    }
  };

  const createReferralCode = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/dealer/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createCode",
          code: referralCodeDraft,
          customerDiscountPercent: Number(newCodeCustomerDiscount),
          ownerCommissionPercent: Number(newCodeOwnerCommission),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "新增推薦碼失敗");
      await loadReferrals();
      setReferralCodeDraft("");
      setSelectedReferralCode(result.code.code);
      setMessage(`推薦碼 ${result.code.code} 已新增`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增推薦碼失敗");
    } finally {
      setBusy(false);
    }
  };

  const updateReferralCodeSettings = async (code: DealerReferralCode) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/dealer/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateCodeSettings",
          codeId: code.id,
          customerDiscountPercent: Number(code.customer_discount_percent),
          ownerCommissionPercent: Number(code.owner_commission_percent),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "儲存分配設定失敗");
      setMessage(`推薦碼 ${code.code} 的分配設定已儲存`);
      await loadReferrals();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存分配設定失敗");
    } finally {
      setBusy(false);
    }
  };

  const changeReferralCodeSplit = (
    id: string,
    field: "customer_discount_percent" | "owner_commission_percent",
    value: string,
  ) => {
    setReferralCodes((current) =>
      current.map((code) =>
        code.id === id ? { ...code, [field]: Number(value) } : code,
      ),
    );
  };

  const requestReferralPayout = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/dealer/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "requestPayout",
          code: selectedReferralCode,
          note: payoutNote,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "申請撥款失敗");
      setPayoutNote("");
      setMessage(
        `推薦碼 ${selectedReferralCode} 已申請撥款 ${money(result.payout?.amount || 0)}`,
      );
      await loadReferrals();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "申請撥款失敗");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setDealer(null);
    setSessionEmail("");
    setProducts([]);
  };

  if (checking)
    return (
      <main className="min-h-screen grid place-items-center bg-[#090916] text-white">
        <RefreshCw className="animate-spin text-[#55d5ea]" />
      </main>
    );

  if (!sessionEmail)
    return (
      <main className="min-h-screen bg-[#090916] px-5 py-10 text-white">
        <div className="mx-auto max-w-md">
          <Link href="/" className="text-sm text-white/45 hover:text-white">
            ← 返回一飛通全球漫遊
          </Link>
          <div className="mt-10 border-b border-white/10 pb-7">
            <Building2 className="mb-5 text-[#55d5ea]" size={36} />
            <h1 className="text-3xl font-black">經銷商專區</h1>
            <p className="mt-2 text-white/50">代客選購、餘額管理與訂單進度</p>
          </div>
          <div className="mt-7 grid grid-cols-2 border-b border-white/10">
            <button
              onClick={() => setAuthMode("login")}
              className={`py-3 font-semibold ${authMode === "login" ? "border-b-2 border-[#ff4f73] text-white" : "text-white/40"}`}
            >
              登入
            </button>
            <button
              onClick={() => setAuthMode("register")}
              className={`py-3 font-semibold ${authMode === "register" ? "border-b-2 border-[#ff4f73] text-white" : "text-white/40"}`}
            >
              申請經銷商
            </button>
          </div>
          <form onSubmit={handleAuth} className="mt-6 space-y-4">
            {authMode === "register" && (
              <>
                <p className="text-sm leading-6 text-white/50">
                  已有一飛通一般會員帳號，可直接輸入原 Email
                  與密碼申請，不需要重新註冊。
                </p>
                <ApplicationFields
                  value={application}
                  onChange={setApplication}
                />
              </>
            )}
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
              />
            </Field>
            <Field label="密碼">
              <input
                type="password"
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
              />
            </Field>
            <button
              disabled={busy}
              className="h-12 w-full rounded-md bg-[#ff4f73] font-black disabled:opacity-50"
            >
              {busy
                ? "處理中..."
                : authMode === "login"
                  ? "登入經銷商專區"
                  : "送出經銷商申請"}
            </button>
          </form>
          {message && (
            <p
              role="status"
              className="mt-5 border-l-2 border-[#55d5ea] pl-3 text-sm text-white/70"
            >
              {message}
            </p>
          )}
        </div>
      </main>
    );

  if (!dealer)
    return (
      <main className="min-h-screen bg-[#090916] px-5 py-10 text-white">
        <div className="mx-auto max-w-lg">
          <div className="flex justify-between">
            <Link href="/" className="text-white/50">
              ← 返回首頁
            </Link>
            <button onClick={logout} className="text-white/50">
              登出
            </button>
          </div>
          <h1 className="mt-10 text-3xl font-black">申請經銷商帳號</h1>
          <p className="mt-2 text-white/50">目前登入：{sessionEmail}</p>
          <form
            onSubmit={sendExistingMemberApplication}
            className="mt-7 space-y-4"
          >
            <ApplicationFields value={application} onChange={setApplication} />
            <button
              disabled={busy}
              className="h-12 w-full rounded-md bg-[#ff4f73] font-black"
            >
              送出審核
            </button>
          </form>
          {message && <p className="mt-4 text-[#55d5ea]">{message}</p>}
        </div>
      </main>
    );

  if (dealer.status !== "approved") {
    const content =
      dealer.status === "pending"
        ? ["申請審核中", "後台審核開通後，即可查看經銷價格與代客下單。"]
        : dealer.status === "rejected"
          ? ["申請未通過", "請確認店家資料或聯繫客服後重新申請。"]
          : ["帳號目前停用", "請聯繫客服確認帳號狀態。"];
    return (
      <main className="min-h-screen grid place-items-center bg-[#090916] px-5 text-white">
        <div className="w-full max-w-md">
          <Building2 className="mb-5 text-[#55d5ea]" size={38} />
          <h1 className="text-3xl font-black">{content[0]}</h1>
          <p className="mt-3 text-white/50">{content[1]}</p>
          <p className="mt-6 border-y border-white/10 py-4">
            {dealer.store_name}
            <br />
            <span className="text-sm text-white/40">{dealer.email}</span>
          </p>
          <div className="mt-6 flex gap-3">
            {dealer.status === "rejected" && (
              <button
                onClick={() => setDealer(null)}
                className="rounded-md bg-[#ff4f73] px-5 py-3 font-bold"
              >
                重新申請
              </button>
            )}
            <button
              onClick={logout}
              className="rounded-md border border-white/15 px-5 py-3"
            >
              登出
            </button>
          </div>
          {message && <p className="mt-4 text-[#55d5ea]">{message}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090916] text-white">
      <header className="border-b border-white/10 bg-[#101020] px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-white/40">一飛通經銷商</p>
            <h1 className="font-bold">{dealer.store_name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`rounded-md border px-3 py-2 text-right ${dealer.sales_mode === "referral" ? "border-emerald-300/25 bg-emerald-300/8" : "border-amber-300/25 bg-amber-300/8"}`}
            >
              <p className="text-[11px] text-white/40">
                {dealer.sales_mode === "referral" ? "推薦碼數量" : "可用餘額"}
              </p>
              <p
                className={`font-black ${dealer.sales_mode === "referral" ? "text-emerald-300" : "text-amber-300"}`}
              >
                {dealer.sales_mode === "referral"
                  ? `${referralCodes.length} 個`
                  : money(dealer.balance)}
              </p>
            </div>
            <button onClick={logout} title="登出" className="p-3 text-white/45">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>
      <nav className="sticky top-0 z-20 border-b border-white/10 bg-[#090916]/95 px-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-6">
          {(dealer.sales_mode === "referral"
            ? ([
                ["sale", "推薦方案"],
                ["orders", "成交分潤"],
                ["balance", "撥款紀錄"],
              ] as const)
            : ([
                ["sale", "代客販售"],
                ["orders", "經銷訂單"],
                ["balance", "加值與帳本"],
              ] as const)
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`py-4 text-sm font-bold ${view === key ? "border-b-2 border-[#ff4f73]" : "text-white/40"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      <div
        className={`mx-auto max-w-7xl px-4 pt-7 ${dealer.sales_mode !== "referral" && view === "sale" && cartItems.length ? "pb-28 lg:pb-7" : "pb-7"}`}
      >
        {message && (
          <div className="mb-6 border-l-2 border-[#55d5ea] bg-white/5 px-4 py-3 text-sm">
            {message}
          </div>
        )}
        {dealer.sales_mode === "referral" && view === "sale" && (
          <MultiReferralCatalog
            dealer={dealer}
            products={products}
            codes={referralCodes}
            commissions={referralCommissions}
            selectedCode={selectedReferralCode}
            selectedCountry={selectedCountry}
            selectedDays={selectedDays}
            referralCodeDraft={referralCodeDraft}
            newCustomerDiscount={newCodeCustomerDiscount}
            newOwnerCommission={newCodeOwnerCommission}
            busy={busy}
            onCodeChange={setReferralCodeDraft}
            onNewCustomerDiscount={setNewCodeCustomerDiscount}
            onNewOwnerCommission={setNewCodeOwnerCommission}
            onChangeSplit={changeReferralCodeSplit}
            onSaveSplit={(code) => void updateReferralCodeSettings(code)}
            onCreateCode={() => void createReferralCode()}
            onSelectCode={setSelectedReferralCode}
            onChooseCountry={chooseCountry}
            onReturn={returnToCountries}
            onChooseDays={setSelectedDays}
          />
        )}
        {dealer.sales_mode === "referral" && view === "orders" && (
          <MultiReferralEarnings
            codes={referralCodes}
            selectedCode={selectedReferralCode}
            onSelectCode={setSelectedReferralCode}
            commissions={referralCommissions}
          />
        )}
        {dealer.sales_mode === "referral" && view === "balance" && (
          <MultiReferralPayoutPanel
            codes={referralCodes}
            selectedCode={selectedReferralCode}
            onSelectCode={setSelectedReferralCode}
            commissions={referralCommissions}
            payouts={referralPayouts}
            note={payoutNote}
            busy={busy}
            onNoteChange={setPayoutNote}
            onRequest={() => void requestReferralPayout()}
          />
        )}
        {dealer.sales_mode !== "referral" && view === "sale" && (
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <section ref={salesCatalogRef} className="scroll-mt-20">
              {!selectedCountry ? (
                <>
                  <div>
                    <p className="text-sm font-bold text-[#55d5ea]">代客販售</p>
                    <h2 className="mt-1 text-2xl font-black">選擇 eSIM 國家</h2>
                    <p className="mt-2 text-sm text-white/40">
                      點選客戶要前往的國家，再選擇使用天數與方案。
                    </p>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {countries.map((item) => {
                      const info = getEsimCountryInfo(item);
                      const dayCount = new Set(
                        products
                          .filter((product) => product.country === item)
                          .map((product) => product.validity_days),
                      ).size;
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => chooseCountry(item)}
                          className="group flex min-h-28 flex-col items-start justify-between rounded-xl border border-white/10 bg-[#121222] p-4 text-left transition hover:border-[#55d5ea]/50 hover:bg-[#18182b]"
                        >
                          <span className="text-3xl" aria-hidden="true">
                            {info.flag}
                          </span>
                          <span className="mt-4 flex w-full items-end justify-between gap-2">
                            <span>
                              <span className="block font-black">{item}</span>
                              <span className="mt-0.5 block text-xs text-white/35">
                                {dayCount} 種天數
                              </span>
                            </span>
                            <ChevronRight
                              size={18}
                              className="mb-1 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-[#55d5ea]"
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={returnToCountries}
                    className="inline-flex items-center gap-2 text-sm font-bold text-white/50 hover:text-white"
                  >
                    <ArrowLeft size={17} />
                    返回選擇國家
                  </button>
                  <div className="mt-5 flex items-center gap-4 border-b border-white/10 pb-5">
                    <span className="text-4xl" aria-hidden="true">
                      {getEsimCountryInfo(selectedCountry).flag}
                    </span>
                    <div>
                      <p className="text-sm text-[#55d5ea]">代客販售</p>
                      <h2 className="text-2xl font-black">
                        {selectedCountry} eSIM
                      </h2>
                    </div>
                  </div>
                  <div className="py-6">
                    <h3 className="font-black">選擇使用天數</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {availableDays.map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setSelectedDays(days)}
                          className={`min-w-20 rounded-md border px-4 py-3 font-black transition ${selectedDays === days ? "border-[#ff4f73] bg-[#ff4f73] text-white" : "border-white/12 bg-white/5 text-white/65 hover:border-white/30 hover:text-white"}`}
                        >
                          {days} 天
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedDays === null ? (
                    <div className="rounded-xl border border-dashed border-white/12 px-5 py-10 text-center text-sm text-white/35">
                      請先選擇客戶要使用的天數
                    </div>
                  ) : (
                    <div>
                      <div className="mb-3 flex items-end justify-between gap-3">
                        <h3 className="text-lg font-black">
                          {selectedDays} 天方案
                        </h3>
                        <span className="text-xs text-white/35">
                          共 {filteredProducts.length} 個方案
                        </span>
                      </div>
                      <div className="divide-y divide-white/8 border-y border-white/10">
                        {filteredProducts.map((product) => (
                          <article
                            key={product.id}
                            className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                          >
                            <div>
                              <p className="font-semibold">{product.name}</p>
                              <p className="mt-1 text-sm text-white/40">
                                {product.country} · {product.validity_days} 天
                                {product.data_amount
                                  ? ` · ${product.data_amount}`
                                  : ""}
                              </p>
                            </div>
                            <div className="flex items-center justify-between gap-4 sm:justify-end">
                              <div className="text-right">
                                <p className="font-black text-[#55d5ea]">
                                  {money(product.dealer_price)}
                                </p>
                                <p className="text-xs text-white/35">經銷價</p>
                                <p className="text-xs text-white/25 line-through">
                                  官網售價 {money(product.retail_price)}
                                </p>
                              </div>
                              <button
                                onClick={() => changeQuantity(product.id, 1)}
                                title={`加入 ${product.name}`}
                                className="grid size-10 place-items-center rounded-md bg-[#ff4f73]"
                              >
                                <Plus size={20} />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <h2 className="text-xl font-black">本次代客訂單</h2>
              <div className="mt-4 divide-y divide-white/8 border-y border-white/10">
                {cartItems.length ? (
                  cartItems.map((item) => (
                    <div key={item.id} className="py-3">
                      <p className="text-sm font-medium">{item.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[#55d5ea]">
                          {money(
                            Number(item.dealer_price || 0) * item.quantity,
                          )}
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => changeQuantity(item.id, -1)}
                            className="p-1"
                          >
                            <Minus size={17} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            onClick={() => changeQuantity(item.id, 1)}
                            className="p-1"
                          >
                            <Plus size={17} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-7 text-sm text-white/35">尚未選擇商品</p>
                )}
              </div>
              <div className="flex justify-between py-4 text-lg font-black">
                <span>經銷扣款</span>
                <span>{money(cartTotal)}</span>
              </div>
              <Field label="客戶 Email（安裝資料寄送至此）">
                <input
                  ref={customerEmailRef}
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="field"
                  placeholder="customer@example.com"
                />
              </Field>
              <div className="mt-3">
                <Field label="客戶姓名（選填）">
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="field"
                  />
                </Field>
              </div>
              <button
                onClick={handleOrderAction}
                disabled={busy || !cartItems.length}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#ff4f73] font-black disabled:opacity-40"
              >
                <Send size={18} />
                {busy ? "建立中..." : "扣款並寄送 eSIM"}
              </button>
              <p className="mt-3 text-xs leading-5 text-white/35">
                系統會將 QR Code 與一鍵安裝連結直接寄給客戶。客戶使用相同 Email
                登入一飛通後，也可在會員中心查看。
              </p>
            </aside>
          </div>
        )}
        {dealer.sales_mode !== "referral" && view === "orders" && (
          <section>
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-black">經銷訂單</h2>
                <p className="mt-1 text-sm text-white/40">最近 50 筆代客販售</p>
              </div>
              <button
                onClick={loadOrders}
                title="重新整理"
                className="p-2 text-white/50"
              >
                <RefreshCw size={19} />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {orders.length ? (
                orders.map((order) => {
                  const normal = first(order.orders);
                  const isCancelled =
                    normal?.order_status === "CANCELLED" ||
                    normal?.payment_status === "REFUNDED";
                  const draftEmail =
                    orderEmails[order.id] ?? order.customer_email;
                  return (
                    <article
                      key={order.id}
                      className={`rounded-xl border p-4 sm:p-5 ${isCancelled ? "border-rose-400/25 bg-rose-500/[0.04]" : "border-white/10 bg-white/[0.025]"}`}
                    >
                      <div className="grid gap-3 md:grid-cols-[160px_1fr_auto] md:items-start">
                        <div>
                          <p className="font-mono text-sm">
                            {normal?.order_number}
                          </p>
                          <p className="mt-1 text-xs text-white/35">
                            {new Date(order.created_at).toLocaleString("zh-TW")}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-white/45">收件 Email</p>
                          <p className="break-all font-medium">
                            {order.customer_email}
                          </p>
                        </div>
                        <div className="md:text-right">
                          <p className="font-black text-amber-300">
                            {money(order.dealer_total)}
                          </p>
                          <p
                            className={`mt-1 text-xs font-bold ${isCancelled ? "text-rose-300" : "text-[#55d5ea]"}`}
                          >
                            {isCancelled
                              ? "已取消／已退款"
                              : order.dealer_order_items.every(
                                    (item) =>
                                      item.delivery_email_status === "sent",
                                  )
                                ? "已寄送安裝資料"
                                : normal?.order_status === "COMPLETED"
                                  ? "寄送處理中"
                                  : "eSIM 準備中"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 divide-y divide-white/8 border-y border-white/8">
                        {order.dealer_order_items.map((item) => {
                          const product = first(item.products);
                          const orderItem = first(item.order_items);
                          const inventory = orderItem
                            ? first(orderItem.e_sim_inventory)
                            : null;
                          return (
                            <div
                              key={item.id}
                              className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_210px_110px] sm:items-center"
                            >
                              <div>
                                <p className="font-medium">{product?.name}</p>
                                <p className="mt-1 text-xs text-white/35">
                                  {product?.country} · {product?.validity_days}{" "}
                                  天
                                </p>
                              </div>
                              <p className="break-all font-mono text-xs text-white/60">
                                <span className="font-sans text-white/35">
                                  ICCID：
                                </span>
                                {inventory?.iccid ||
                                  (isCancelled ? "已解除綁定" : "配發中")}
                              </p>
                              <p
                                className={`font-bold ${isCancelled ? "text-rose-300" : installStatus(item) === "尚未安裝" ? "text-white/50" : "text-emerald-300"}`}
                              >
                                {isCancelled ? "已取消" : installStatus(item)}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {isCancelled ? (
                        <p className="mt-4 rounded-lg border border-rose-400/15 bg-rose-500/[0.06] px-3 py-2 text-sm text-rose-200">
                          此訂單已由後台取消，經銷扣款已退回餘額，無法再次寄送。
                        </p>
                      ) : (
                        <>
                          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                            <input
                              type="email"
                              aria-label={`${normal?.order_number || "訂單"}收件 Email`}
                              value={draftEmail}
                              onChange={(event) =>
                                setOrderEmails((current) => ({
                                  ...current,
                                  [order.id]: event.target.value,
                                }))
                              }
                              className="field"
                              placeholder="customer@example.com"
                            />
                            <button
                              type="button"
                              onClick={() => void resendOrderEmail(order)}
                              disabled={
                                sendingOrderId === order.id ||
                                !draftEmail.trim()
                              }
                              className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#ff4f73] px-5 font-black disabled:opacity-45"
                            >
                              {sendingOrderId === order.id ? (
                                <RefreshCw size={17} className="animate-spin" />
                              ) : (
                                <Mail size={17} />
                              )}
                              {sendingOrderId === order.id
                                ? "寄送中..."
                                : "更新 Email 並再次寄送"}
                            </button>
                          </div>
                          <p className="mt-2 text-xs text-white/30">
                            再次寄送不會重複扣款；修改 Email
                            後，會員中心訂單也會改綁定到新 Email。
                          </p>
                        </>
                      )}
                    </article>
                  );
                })
              ) : (
                <p className="py-12 text-center text-white/35">尚無經銷訂單</p>
              )}
            </div>
          </section>
        )}
        {dealer.sales_mode !== "referral" && (
          <>
            {view === "balance" && (
              <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
                <section>
                  <WalletCards className="text-amber-300" />
                  <h2 className="mt-4 text-2xl font-black">申請現金加值</h2>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    先向一飛通完成現金付款，再送出申請。後台核准後餘額才會增加。
                  </p>
                  <form onSubmit={requestTopup} className="mt-6 space-y-4">
                    <Field label="申請金額">
                      <input
                        type="number"
                        min="1"
                        max="1000000"
                        required
                        value={topupAmount}
                        onChange={(e) => setTopupAmount(e.target.value)}
                        className="field"
                      />
                    </Field>
                    <Field label="付款備註（選填）">
                      <textarea
                        rows={3}
                        value={topupNote}
                        onChange={(e) => setTopupNote(e.target.value)}
                        className="field py-3"
                        placeholder="例如：現金交付日期"
                      />
                    </Field>
                    <button
                      disabled={busy}
                      className="h-12 w-full rounded-md bg-[#ff4f73] font-black"
                    >
                      送出加值申請
                    </button>
                  </form>
                </section>
                <section>
                  <h2 className="text-2xl font-black">餘額帳本</h2>
                  <div className="mt-5 divide-y divide-white/8 border-y border-white/10">
                    {transactions.length ? (
                      transactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="grid grid-cols-[1fr_auto] gap-3 py-4"
                        >
                          <div>
                            <p>{transaction.reason}</p>
                            <p className="mt-1 text-xs text-white/35">
                              {new Date(transaction.created_at).toLocaleString(
                                "zh-TW",
                              )}{" "}
                              · 餘額 {money(transaction.balance_after)}
                            </p>
                          </div>
                          <p
                            className={`font-black ${transaction.amount > 0 ? "text-emerald-300" : "text-rose-300"}`}
                          >
                            {transaction.amount > 0 ? "+" : ""}
                            {money(transaction.amount)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="py-10 text-center text-white/35">
                        尚無餘額紀錄
                      </p>
                    )}
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </div>
      {dealer.sales_mode !== "referral" &&
        view === "sale" &&
        cartItems.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#101020]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_32px_rgba(0,0,0,0.45)] backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-lg items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/45">
                  {cartItems.reduce((sum, item) => sum + item.quantity, 0)} 件
                  eSIM
                </p>
                <p className="truncate text-lg font-black text-[#55d5ea]">
                  {money(cartTotal)}
                </p>
              </div>
              <button
                onClick={handleOrderAction}
                disabled={busy}
                className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-[#ff4f73] px-5 font-black disabled:opacity-50"
              >
                <Send size={18} />
                {busy ? "建立中..." : "扣款並寄送 eSIM"}
              </button>
            </div>
          </div>
        )}
    </main>
  );
}

function ReferralCodeTabs({
  codes,
  selectedCode,
  onSelectCode,
}: {
  codes: DealerReferralCode[];
  selectedCode: string;
  onSelectCode: (code: string) => void;
}) {
  if (!codes.length)
    return (
      <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/45">
        尚未建立推薦碼，請先到「推薦方案」新增。
      </p>
    );
  return (
    <div className="flex flex-wrap gap-2">
      {codes.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelectCode(item.code)}
          className={`rounded-md border px-4 py-2 font-mono text-sm font-black ${selectedCode === item.code ? "border-emerald-300 bg-emerald-300 text-black" : "border-white/15 bg-white/5 text-white/65"}`}
        >
          {item.code}
        </button>
      ))}
    </div>
  );
}

function MultiReferralCatalog({
  dealer,
  products,
  codes,
  commissions,
  selectedCode,
  selectedCountry,
  selectedDays,
  referralCodeDraft,
  newCustomerDiscount,
  newOwnerCommission,
  busy,
  onCodeChange,
  onNewCustomerDiscount,
  onNewOwnerCommission,
  onChangeSplit,
  onSaveSplit,
  onCreateCode,
  onSelectCode,
  onChooseCountry,
  onReturn,
  onChooseDays,
}: {
  dealer: Dealer;
  products: Product[];
  codes: DealerReferralCode[];
  commissions: ReferralCommission[];
  selectedCode: string;
  selectedCountry: string;
  selectedDays: number | null;
  referralCodeDraft: string;
  newCustomerDiscount: string;
  newOwnerCommission: string;
  busy: boolean;
  onCodeChange: (value: string) => void;
  onNewCustomerDiscount: (value: string) => void;
  onNewOwnerCommission: (value: string) => void;
  onChangeSplit: (
    id: string,
    field: "customer_discount_percent" | "owner_commission_percent",
    value: string,
  ) => void;
  onSaveSplit: (code: DealerReferralCode) => void;
  onCreateCode: () => void;
  onSelectCode: (code: string) => void;
  onChooseCountry: (country: string) => void;
  onReturn: () => void;
  onChooseDays: (days: number) => void;
}) {
  const countries = Array.from(
    new Set(products.map((item) => item.country)),
  ).sort((a, b) => a.localeCompare(b, "zh-TW"));
  const days = Array.from(
    new Set(
      products
        .filter((item) => item.country === selectedCountry)
        .map((item) => item.validity_days),
    ),
  ).sort((a, b) => a - b);
  const activeCode =
    codes.find((item) => item.code === selectedCode) || codes[0];
  const filtered = products
    .filter(
      (item) =>
        item.country === selectedCountry && item.validity_days === selectedDays,
    )
    .map((product) => ({
      ...product,
      commission_amount: activeCode
        ? Math.round(
            (Number(product.retail_price) *
              Number(activeCode.owner_commission_percent)) /
              100,
          )
        : 0,
    }));
  return (
    <div>
      <section className="border-b border-white/10 pb-7">
        <p className="text-sm font-bold text-emerald-300">官網推薦成交</p>
        <h2 className="mt-1 text-2xl font-black">我的推薦碼</h2>
        <p className="mt-2 text-sm leading-6 text-white/45">
          後台核准可分配總比例為 {Number(dealer.referral_share_percent || 0)}
          %。每個推薦碼可自行分配客戶折扣與本人分潤，兩者合計不可超過核准比例。
        </p>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {codes.map((item) => {
            const total =
              Number(item.customer_discount_percent) +
              Number(item.owner_commission_percent);
            const codeSummary = summarizeReferrals(commissions, item.code);
            const hasUnrequestedCommission =
              codeSummary.pendingAmount > 0 || codeSummary.availableAmount > 0;
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 ${selectedCode === item.code ? "border-emerald-300 bg-emerald-300/[0.08]" : "border-emerald-300/20 bg-emerald-300/[0.05]"}`}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onSelectCode(item.code)}
                    className="font-mono text-lg font-black text-emerald-300"
                  >
                    {item.code}
                  </button>
                  <button
                    type="button"
                    title="複製推薦碼"
                    onClick={() =>
                      void navigator.clipboard.writeText(item.code)
                    }
                    className="grid size-9 place-items-center rounded-md border border-white/15"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="text-xs text-white/45">
                    給客戶折扣（%）
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="0.01"
                      disabled={hasUnrequestedCommission}
                      value={item.customer_discount_percent}
                      onChange={(event) =>
                        onChangeSplit(
                          item.id,
                          "customer_discount_percent",
                          event.target.value,
                        )
                      }
                      className="field mt-1"
                    />
                  </label>
                  <label className="text-xs text-white/45">
                    本人分潤（%）
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="0.01"
                      disabled={hasUnrequestedCommission}
                      value={item.owner_commission_percent}
                      onChange={(event) =>
                        onChangeSplit(
                          item.id,
                          "owner_commission_percent",
                          event.target.value,
                        )
                      }
                      className="field mt-1"
                    />
                  </label>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p
                    className={`text-xs ${total > Number(dealer.referral_share_percent) ? "text-rose-300" : "text-white/35"}`}
                  >
                    合計 {total}%／上限 {Number(dealer.referral_share_percent)}%
                  </p>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      hasUnrequestedCommission ||
                      total > Number(dealer.referral_share_percent)
                    }
                    onClick={() => onSaveSplit(item)}
                    className="rounded-md bg-emerald-300 px-3 py-2 text-xs font-black text-black disabled:opacity-40"
                  >
                    儲存設定
                  </button>
                </div>
                {hasUnrequestedCommission && (
                  <p className="mt-3 rounded-md bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-200">
                    尚有{" "}
                    {money(
                      codeSummary.pendingAmount + codeSummary.availableAmount,
                    )}{" "}
                    未請款分潤。請先到「撥款紀錄」全額申請撥款，後續才能修改比例。
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-5 rounded-xl border border-dashed border-white/15 p-4">
          <p className="font-bold">新增推薦碼</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_120px_auto]">
            <input
              value={referralCodeDraft}
              onChange={(event) =>
                onCodeChange(event.target.value.toUpperCase())
              }
              maxLength={24}
              className="field min-w-0"
              aria-label="新增推薦碼"
              placeholder="輸入新的推薦碼"
            />
            <input
              type="number"
              min="0"
              max="30"
              step="0.01"
              value={newCustomerDiscount}
              onChange={(event) => onNewCustomerDiscount(event.target.value)}
              className="field"
              aria-label="新推薦碼客戶折扣"
              placeholder="客戶折扣%"
            />
            <input
              type="number"
              min="0"
              max="30"
              step="0.01"
              value={newOwnerCommission}
              onChange={(event) => onNewOwnerCommission(event.target.value)}
              className="field"
              aria-label="新推薦碼本人分潤"
              placeholder="本人分潤%"
            />
            <button
              type="button"
              onClick={onCreateCode}
              disabled={busy || !referralCodeDraft.trim()}
              className="shrink-0 rounded-md bg-emerald-300 px-5 font-black text-black disabled:opacity-40"
            >
              <Plus size={17} className="mr-1 inline" />
              新增
            </button>
          </div>
          <p className="mt-2 text-xs text-white/35">
            依序填寫：推薦碼、客戶折扣％、本人分潤％。
          </p>
        </div>
      </section>
      <section className="pt-7">
        {!selectedCountry ? (
          <>
            <h3 className="text-xl font-black">選擇 eSIM 國家</h3>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {countries.map((item) => {
                const info = getEsimCountryInfo(item);
                const dayCount = new Set(
                  products
                    .filter((product) => product.country === item)
                    .map((product) => product.validity_days),
                ).size;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onChooseCountry(item)}
                    className="group flex min-h-28 flex-col items-start justify-between rounded-xl border border-white/10 bg-[#121222] p-4 text-left transition hover:border-emerald-300/50"
                  >
                    <span className="text-3xl" aria-hidden="true">
                      {info.flag}
                    </span>
                    <span className="mt-4 flex w-full items-end justify-between gap-2">
                      <span>
                        <span className="block font-black">{item}</span>
                        <span className="text-xs text-white/35">
                          {dayCount} 種天數
                        </span>
                      </span>
                      <ChevronRight size={18} className="text-white/30" />
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onReturn}
              className="inline-flex items-center gap-2 text-sm font-bold text-white/50"
            >
              <ArrowLeft size={17} />
              返回選擇國家
            </button>
            <div className="mt-5 flex items-center gap-4 border-b border-white/10 pb-5">
              <span className="text-4xl">
                {getEsimCountryInfo(selectedCountry).flag}
              </span>
              <div>
                <p className="text-sm text-emerald-300">推薦分潤</p>
                <h2 className="text-2xl font-black">{selectedCountry} eSIM</h2>
              </div>
            </div>
            <div className="py-6">
              <h3 className="font-black">選擇使用天數</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {days.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChooseDays(value)}
                    className={`min-w-20 rounded-md border px-4 py-3 font-black ${selectedDays === value ? "border-emerald-300 bg-emerald-300 text-black" : "border-white/12 bg-white/5 text-white/65"}`}
                  >
                    {value} 天
                  </button>
                ))}
              </div>
            </div>
            {selectedDays === null ? (
              <div className="rounded-xl border border-dashed border-white/12 px-5 py-10 text-center text-sm text-white/35">
                請先選擇天數
              </div>
            ) : (
              <div className="divide-y divide-white/8 border-y border-white/10">
                {filtered.map((product) => (
                  <article
                    key={product.id}
                    className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="mt-1 text-sm text-white/40">
                        {product.country} · {product.validity_days} 天
                        {product.data_amount ? ` · ${product.data_amount}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-white/30">
                        官網售價 {money(product.retail_price)}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-xs text-white/40">每張成交分潤</p>
                      <p className="text-xl font-black text-emerald-300">
                        {money(product.commission_amount || 0)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function MultiReferralEarnings({
  codes,
  selectedCode,
  onSelectCode,
  commissions,
}: {
  codes: DealerReferralCode[];
  selectedCode: string;
  onSelectCode: (code: string) => void;
  commissions: ReferralCommission[];
}) {
  const rows = commissions.filter(
    (item) => item.code_snapshot === selectedCode,
  );
  const summary = summarizeReferrals(rows);
  const labels: Record<string, string> = {
    pending: "待付款",
    available: "可撥款",
    requested: "撥款申請中",
    paid: "已撥款",
    cancelled: "已取消",
  };
  const cards: Array<[string, string | number]> = [
    ["成交筆數", summary.totalOrders],
    ["待付款", money(summary.pendingAmount)],
    ["可撥款", money(summary.availableAmount)],
    ["申請中", money(summary.requestedAmount)],
    ["已撥款", money(summary.paidAmount)],
  ];
  return (
    <section>
      <h2 className="text-2xl font-black">依推薦碼查看成交</h2>
      <div className="mt-4">
        <ReferralCodeTabs
          codes={codes}
          selectedCode={selectedCode}
          onSelectCode={onSelectCode}
        />
      </div>
      {selectedCode && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs text-white/40">{label}</p>
                <p className="mt-2 text-xl font-black text-emerald-300">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <h3 className="mt-8 text-xl font-black">{selectedCode} 成交明細</h3>
          <div className="mt-4 divide-y divide-white/8 border-y border-white/10">
            {rows.length ? (
              rows.map((item) => {
                const order = first(item.orders);
                return (
                  <div
                    key={item.id}
                    className="grid gap-3 py-4 sm:grid-cols-[1fr_120px_120px_120px] sm:items-center"
                  >
                    <div>
                      <p className="font-mono text-sm">
                        {order?.order_number || item.code_snapshot}
                      </p>
                      <p className="mt-1 text-xs text-white/35">
                        {new Date(item.created_at).toLocaleString("zh-TW")} ·{" "}
                        {item.item_count} 張
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/35">客戶實付</p>
                      <p className="font-bold">{money(item.paid_amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/35">分潤</p>
                      <p className="font-black text-emerald-300">
                        {money(item.commission_amount)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-white/60">
                      {labels[item.status] || item.status}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="py-12 text-center text-white/35">
                這個推薦碼尚無成交
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function MultiReferralPayoutPanel({
  codes,
  selectedCode,
  onSelectCode,
  commissions,
  payouts,
  note,
  busy,
  onNoteChange,
  onRequest,
}: {
  codes: DealerReferralCode[];
  selectedCode: string;
  onSelectCode: (code: string) => void;
  commissions: ReferralCommission[];
  payouts: ReferralPayout[];
  note: string;
  busy: boolean;
  onNoteChange: (value: string) => void;
  onRequest: () => void;
}) {
  const summary = summarizeReferrals(commissions, selectedCode);
  const codePayouts = payouts.filter(
    (item) => item.code_snapshot === selectedCode,
  );
  return (
    <section>
      <h2 className="text-2xl font-black">依推薦碼申請撥款</h2>
      <div className="mt-4">
        <ReferralCodeTabs
          codes={codes}
          selectedCode={selectedCode}
          onSelectCode={onSelectCode}
        />
      </div>
      {selectedCode && (
        <div className="mt-7 grid gap-8 lg:grid-cols-[360px_1fr]">
          <div>
            <HandCoins className="text-emerald-300" />
            <h3 className="mt-4 text-xl font-black">{selectedCode} 分潤撥款</h3>
            <p className="mt-2 text-sm leading-6 text-white/45">
              此推薦碼目前可申請 {money(summary.availableAmount)}
              ，不會合併其他推薦碼的分潤。
            </p>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              className="field mt-5 py-3"
              placeholder="撥款備註（選填）"
            />
            <button
              type="button"
              onClick={onRequest}
              disabled={
                busy ||
                summary.availableAmount <= 0 ||
                summary.requestedAmount > 0
              }
              className="mt-3 h-12 w-full rounded-md bg-emerald-300 font-black text-black disabled:opacity-40"
            >
              申請撥款 {money(summary.availableAmount)}
            </button>
            {summary.requestedAmount > 0 && (
              <p className="mt-3 text-sm text-amber-200">
                此推薦碼已有 {money(summary.requestedAmount)} 撥款申請處理中
              </p>
            )}
          </div>
          <div>
            <h3 className="text-xl font-black">{selectedCode} 撥款紀錄</h3>
            <div className="mt-5 divide-y divide-white/8 border-y border-white/10">
              {codePayouts.length ? (
                codePayouts.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_auto] gap-3 py-4"
                  >
                    <div>
                      <p>
                        {item.status === "paid"
                          ? "已完成撥款"
                          : item.status === "requested"
                            ? "撥款申請處理中"
                            : item.status === "rejected"
                              ? "已退回可撥款"
                              : "已取消"}
                      </p>
                      <p className="mt-1 text-xs text-white/35">
                        {new Date(item.requested_at).toLocaleString("zh-TW")}
                        {item.admin_note ? ` · ${item.admin_note}` : ""}
                      </p>
                    </div>
                    <p className="font-black text-emerald-300">
                      {money(item.amount)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-10 text-center text-white/35">
                  這個推薦碼尚無撥款紀錄
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* Legacy single-code components retained here temporarily for reference.
function ReferralCatalog({ dealer, products, selectedCountry, selectedDays, referralCodeDraft, busy, onCodeChange, onUpdateCode, onChooseCountry, onReturn, onChooseDays }: {
  dealer: Dealer; products: Product[]; selectedCountry: string; selectedDays: number | null; referralCodeDraft: string; busy: boolean;
  onCodeChange: (value: string) => void; onUpdateCode: () => void; onChooseCountry: (country: string) => void; onReturn: () => void; onChooseDays: (days: number) => void;
}) {
  const countries = Array.from(new Set(products.map(item => item.country))).sort((a, b) => a.localeCompare(b, 'zh-TW'));
  const days = Array.from(new Set(products.filter(item => item.country === selectedCountry).map(item => item.validity_days))).sort((a, b) => a - b);
  const filtered = products.filter(item => item.country === selectedCountry && item.validity_days === selectedDays);
  return <div><section className="grid gap-4 border-b border-white/10 pb-7 md:grid-cols-[1fr_auto] md:items-end"><div><p className="text-sm font-bold text-emerald-300">官網推薦成交</p><h2 className="mt-1 text-2xl font-black">推薦碼與方案分潤</h2><p className="mt-2 text-sm leading-6 text-white/45">客戶在一飛通官網選購，結帳時輸入推薦碼。此頁只顯示每張成交分潤，不顯示經銷價格。</p><p className="mt-1 text-xs text-white/35">客戶使用推薦碼享 {Number(dealer.referral_discount_percent || 0)}% 折扣</p></div><div className="flex gap-2"><input value={referralCodeDraft} onChange={event => onCodeChange(event.target.value.toUpperCase())} maxLength={24} className="field min-w-0 md:w-56" aria-label="推薦碼"/><button type="button" onClick={onUpdateCode} disabled={busy} className="shrink-0 rounded-md bg-emerald-300 px-4 font-black text-black disabled:opacity-50">更新</button><button type="button" title="複製推薦碼" onClick={() => void navigator.clipboard.writeText(dealer.referral_code || '')} className="grid size-11 shrink-0 place-items-center rounded-md border border-white/15"><Copy size={17}/></button></div></section><section className="pt-7">{!selectedCountry ? <><h3 className="text-xl font-black">選擇 eSIM 國家</h3><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{countries.map(item => { const info = getEsimCountryInfo(item); const dayCount = new Set(products.filter(product => product.country === item).map(product => product.validity_days)).size; return <button key={item} type="button" onClick={() => onChooseCountry(item)} className="group flex min-h-28 flex-col items-start justify-between rounded-xl border border-white/10 bg-[#121222] p-4 text-left transition hover:border-emerald-300/50"><span className="text-3xl" aria-hidden="true">{info.flag}</span><span className="mt-4 flex w-full items-end justify-between gap-2"><span><span className="block font-black">{item}</span><span className="text-xs text-white/35">{dayCount} 種天數</span></span><ChevronRight size={18} className="text-white/30"/></span></button>; })}</div></> : <><button type="button" onClick={onReturn} className="inline-flex items-center gap-2 text-sm font-bold text-white/50"><ArrowLeft size={17}/>返回選擇國家</button><div className="mt-5 flex items-center gap-4 border-b border-white/10 pb-5"><span className="text-4xl">{getEsimCountryInfo(selectedCountry).flag}</span><div><p className="text-sm text-emerald-300">推薦分潤</p><h2 className="text-2xl font-black">{selectedCountry} eSIM</h2></div></div><div className="py-6"><h3 className="font-black">選擇使用天數</h3><div className="mt-3 flex flex-wrap gap-2">{days.map(value => <button key={value} type="button" onClick={() => onChooseDays(value)} className={`min-w-20 rounded-md border px-4 py-3 font-black ${selectedDays === value ? 'border-emerald-300 bg-emerald-300 text-black' : 'border-white/12 bg-white/5 text-white/65'}`}>{value} 天</button>)}</div></div>{selectedDays === null ? <div className="rounded-xl border border-dashed border-white/12 px-5 py-10 text-center text-sm text-white/35">請先選擇天數</div> : <div className="divide-y divide-white/8 border-y border-white/10">{filtered.map(product => <article key={product.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-semibold">{product.name}</p><p className="mt-1 text-sm text-white/40">{product.country} · {product.validity_days} 天{product.data_amount ? ` · ${product.data_amount}` : ''}</p><p className="mt-1 text-xs text-white/30">官網售價 {money(product.retail_price)}</p></div><div className="sm:text-right"><p className="text-xs text-white/40">每張成交分潤</p><p className="text-xl font-black text-emerald-300">{money(product.commission_amount || 0)}</p></div></article>)}</div>}</>}</section></div>;
}

function ReferralEarnings({ summary, commissions }: { summary: ReferralSummary; commissions: ReferralCommission[] }) {
  const cards: Array<[string, string | number]> = [['成交筆數', summary.totalOrders], ['待付款', money(summary.pendingAmount)], ['可撥款', money(summary.availableAmount)], ['申請中', money(summary.requestedAmount)], ['已撥款', money(summary.paidAmount)]];
  const labels: Record<string, string> = { pending: '待付款', available: '可撥款', requested: '撥款申請中', paid: '已撥款', cancelled: '已取消' };
  return <section><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map(([label,value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/40">{label}</p><p className="mt-2 text-xl font-black text-emerald-300">{value}</p></div>)}</div><h2 className="mt-8 text-2xl font-black">推薦成交明細</h2><div className="mt-4 divide-y divide-white/8 border-y border-white/10">{commissions.length ? commissions.map(item => { const order = first(item.orders); return <div key={item.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_120px_120px_120px] sm:items-center"><div><p className="font-mono text-sm">{order?.order_number || item.code_snapshot}</p><p className="mt-1 text-xs text-white/35">{new Date(item.created_at).toLocaleString('zh-TW')} · {item.item_count} 張</p></div><div><p className="text-xs text-white/35">客戶實付</p><p className="font-bold">{money(item.paid_amount)}</p></div><div><p className="text-xs text-white/35">分潤</p><p className="font-black text-emerald-300">{money(item.commission_amount)}</p></div><p className="text-sm font-bold text-white/60">{labels[item.status] || item.status}</p></div>; }) : <p className="py-12 text-center text-white/35">尚無推薦成交</p>}</div></section>;
}

function ReferralPayoutPanel({ summary, payouts, note, busy, onNoteChange, onRequest }: { summary: ReferralSummary; payouts: ReferralPayout[]; note: string; busy: boolean; onNoteChange: (value: string) => void; onRequest: () => void }) {
  return <div className="grid gap-8 lg:grid-cols-[360px_1fr]"><section><HandCoins className="text-emerald-300"/><h2 className="mt-4 text-2xl font-black">申請分潤撥款</h2><p className="mt-2 text-sm leading-6 text-white/45">目前可申請 {money(summary.availableAmount)}。送出後由一飛通後台確認撥款。</p><textarea rows={3} value={note} onChange={event => onNoteChange(event.target.value)} className="field mt-5 py-3" placeholder="撥款備註（選填）"/><button type="button" onClick={onRequest} disabled={busy || summary.availableAmount <= 0 || summary.requestedAmount > 0} className="mt-3 h-12 w-full rounded-md bg-emerald-300 font-black text-black disabled:opacity-40">申請撥款 {money(summary.availableAmount)}</button>{summary.requestedAmount > 0 && <p className="mt-3 text-sm text-amber-200">已有 {money(summary.requestedAmount)} 撥款申請處理中</p>}</section><section><h2 className="text-2xl font-black">撥款紀錄</h2><div className="mt-5 divide-y divide-white/8 border-y border-white/10">{payouts.length ? payouts.map(item => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-4"><div><p>{item.status === 'paid' ? '已完成撥款' : item.status === 'requested' ? '撥款申請處理中' : item.status === 'rejected' ? '已退回可撥款' : '已取消'}</p><p className="mt-1 text-xs text-white/35">{new Date(item.requested_at).toLocaleString('zh-TW')}{item.admin_note ? ` · ${item.admin_note}` : ''}</p></div><p className="font-black text-emerald-300">{money(item.amount)}</p></div>) : <p className="py-10 text-center text-white/35">尚無撥款紀錄</p>}</div></section></div>;
}
*/

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/50">{label}</span>
      {children}
    </label>
  );
}
function ApplicationFields({
  value,
  onChange,
}: {
  value: DealerApplication;
  onChange: (value: DealerApplication) => void;
}) {
  const update = <K extends keyof DealerApplication>(
    key: K,
    next: DealerApplication[K],
  ) => onChange({ ...value, [key]: next });
  const options: Array<{
    mode: DealerSalesMode;
    title: string;
    description: string;
  }> = [
    {
      mode: "direct",
      title: "經銷模式",
      description: "從經銷專區代客下單，自行向客戶報價",
    },
    {
      mode: "referral",
      title: "推薦碼模式",
      description: "客戶到官網結帳輸入推薦碼，依成交取得分潤",
    },
  ];
  return (
    <>
      <Field label="店家／公司名稱">
        <input
          required
          value={value.storeName}
          onChange={(e) => update("storeName", e.target.value)}
          className="field"
        />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm text-white/50">希望合作方式</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option) => (
            <label
              key={option.mode}
              className={`cursor-pointer rounded-xl border p-4 transition ${value.salesMode === option.mode ? "border-[#55d5ea] bg-[#55d5ea]/10" : "border-white/12 bg-white/[0.02]"}`}
            >
              <input
                type="radio"
                name="dealer-sales-mode"
                value={option.mode}
                checked={value.salesMode === option.mode}
                onChange={() => update("salesMode", option.mode)}
                className="sr-only"
              />
              <span className="flex items-center gap-2 font-black">
                <span
                  className={`size-3 rounded-full border ${value.salesMode === option.mode ? "border-[#55d5ea] bg-[#55d5ea]" : "border-white/40"}`}
                />
                {option.title}
              </span>
              <span className="mt-2 block text-xs leading-5 text-white/45">
                {option.description}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-white/35">
          送出後由管理員審核並設定經銷價格或推薦分潤，開通前仍可調整。
        </p>
      </fieldset>
      {value.salesMode === "referral" && (
        <Field label="申請的推薦碼">
          <input
            required
            value={value.referralCode}
            onChange={(e) =>
              update("referralCode", e.target.value.toUpperCase())
            }
            maxLength={24}
            className="field"
            placeholder="例如 TRAVEL88"
            autoComplete="off"
          />
          <p className="mt-2 text-xs leading-5 text-white/35">
            這組推薦碼不可與現有推薦碼或折扣碼重複。
          </p>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="聯絡人">
          <input
            required
            value={value.contactName}
            onChange={(e) => update("contactName", e.target.value)}
            className="field"
          />
        </Field>
        <Field label="電話">
          <input
            required
            value={value.phone}
            onChange={(e) => update("phone", e.target.value)}
            className="field"
          />
        </Field>
      </div>
      <Field label="統一編號（選填）">
        <input
          value={value.taxId}
          onChange={(e) => update("taxId", e.target.value)}
          className="field"
        />
      </Field>
    </>
  );
}
