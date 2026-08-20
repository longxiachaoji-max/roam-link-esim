"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import Link from "next/link";
import Image from "next/image";
import { Barcode, CreditCard, LogOut, MapPin, Send, ShoppingBag, ShoppingCart, User, Wifi, X, Zap } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/lib/supabase";
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { getAnalyticsVisitorId, trackPageView } from "@/lib/analytics";
import { normalizeReferralCode } from '@/lib/referral-code';
import { ESIM_DESTINATIONS, getEsimDestinationHref } from '@/lib/esim-destinations';
import type { HomeCarouselItem } from '@/lib/home-carousel-types';

type EcpayPaymentMethod = 'Credit' | 'ApplePay' | 'BARCODE';
const CART_STORAGE_KEY = 'roam-link-cart-v1';

interface PublicSiteSettings {
  hero_badge: string;
  hero_title: string;
  hero_subtitle: string;
  section_title: string;
  usage_guide: string;
  home_carousel: HomeCarouselItem[];
  contact_title: string;
  contact_email: string;
  contact_phone: string;
  contact_note: string;
  contact_items: Array<{ id: string; label: string; value: string; href: string }>;
}

const shortenHotspotText = (value?: string) => {
  const text = (value || '').trim();
  if (!text) return '';
  if (text.length <= 24) return text;
  return `${text.slice(0, 24)}...`;
};

export default function Home() {
  const [activeRegion, setActiveRegion] = useState("全部");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [isCartHydrated, setIsCartHydrated] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<EcpayPaymentMethod | null>(null);
  const [isTokenCheckoutSubmitting, setIsTokenCheckoutSubmitting] = useState(false);
  const tokenCheckoutLock = useRef(false);
  const [isApplePayAvailable, setIsApplePayAvailable] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  // TopUp modal moved to /member
  const [toastMsg, setToastMsg] = useState("");
  const [checkoutCode, setCheckoutCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [destinationRequest, setDestinationRequest] = useState('');
  const [destinationRequestState, setDestinationRequestState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [destinationRequestMessage, setDestinationRequestMessage] = useState('');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselDragOffset, setCarouselDragOffset] = useState(0);
  const [isCarouselDragging, setIsCarouselDragging] = useState(false);
  const carouselViewportRef = useRef<HTMLDivElement>(null);
  const carouselDragStartXRef = useRef(0);
  const carouselDragOffsetRef = useRef(0);
  const carouselDraggingRef = useRef(false);
  const carouselHasDraggedRef = useRef(false);
  
  // 模擬登入狀態
  const [user, setUser] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authPromoCode, setAuthPromoCode] = useState("");

  // 從資料庫動態載入商品
  const [products, setProducts] = useState<any[]>([]);
  const [regions, setRegions] = useState<string[]>(["全部", "亞洲", "歐洲", "美洲", "大洋洲"]);
  const [productsLoading, setProductsLoading] = useState(true);

  // 展開狀態管理
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [showHiddenGem, setShowHiddenGem] = useState(false);
  // 天數選擇狀態: key = "country|data", value = index in options
  const [selectedDays, setSelectedDays] = useState<Record<string, number>>({});

  // 網站標語設定
  const [siteSettings, setSiteSettings] = useState<PublicSiteSettings>({
    hero_badge: '一飛通全球漫遊 · 2026 全新上線',
    hero_title: '隨時隨地，全球無縫連線',
    hero_subtitle: '無需拔插實體 SIM 卡。掃描 QR Code 即可開通 190+ 國家的高速網路。',
    section_title: '熱門目的地',
    usage_guide: '',
    home_carousel: [],
    contact_title: '聯絡資訊',
    contact_email: 'roamlinktw@gmail.com',
    contact_phone: '',
    contact_note: '如需商品或訂單協助，請透過以下方式與我們聯繫。',
    contact_items: [
      {
        id: 'email',
        label: '客服信箱',
        value: 'roamlinktw@gmail.com',
        href: 'mailto:roamlinktw@gmail.com'
      }
    ]
  });

  // 分頁切換
  const [activeTab, setActiveTab] = useState<'plans' | 'guide'>('plans');
  const activeCarousel = useMemo(
    () => siteSettings.home_carousel.filter(item => item.is_active && item.image_url),
    [siteSettings.home_carousel]
  );
  const currentCarouselBanner = activeCarousel.length > 0
    ? activeCarousel[carouselIndex % activeCarousel.length]
    : null;

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedCountry = searchParams.get('country');
    if (requestedCountry) setSelectedCountry(requestedCountry);
    if (searchParams.get('cart') === 'open') setIsCartOpen(true);
    if (searchParams.get('checkout') === 'open') setIsCheckoutOpen(true);
    trackPageView('roamlink_page_view');
    setIsApplePayAvailable('ApplePaySession' in window);

    // 載入網站設定
    fetch('/api/settings').then(r => r.json()).then(json => {
      if (json.settings) {
        setSiteSettings(current => ({
          ...current,
          ...json.settings,
          home_carousel: Array.isArray(json.settings.home_carousel) ? json.settings.home_carousel : []
        }));
      }
    }).catch(() => {});

    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');
        const json = await res.json();
        if (json.products) {
          setProducts(json.products);
        }
        if (json.regions && json.regions.length > 0) {
          setRegions(json.regions);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
      }
      setProductsLoading(false);
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (activeCarousel.length <= 1 || !currentCarouselBanner || isCarouselDragging) return;
    const timer = window.setTimeout(() => {
      setCarouselIndex(current => (current + 1) % activeCarousel.length);
    }, currentCarouselBanner.duration_seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [activeCarousel.length, currentCarouselBanner, isCarouselDragging]);

  const handleCarouselPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      activeCarousel.length <= 1
      || !event.isPrimary
      || (event.pointerType === 'mouse' && event.button !== 0)
    ) return;

    carouselDragStartXRef.current = event.clientX;
    carouselDragOffsetRef.current = 0;
    carouselDraggingRef.current = true;
    carouselHasDraggedRef.current = false;
    setCarouselDragOffset(0);
    setIsCarouselDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCarouselPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!carouselDraggingRef.current || !event.isPrimary) return;
    const rawOffset = event.clientX - carouselDragStartXRef.current;
    if (Math.abs(rawOffset) > 8) {
      carouselHasDraggedRef.current = true;
      event.preventDefault();
    }

    const currentIndex = carouselIndex % activeCarousel.length;
    const isDraggingPastStart = currentIndex === 0 && rawOffset > 0;
    const isDraggingPastEnd = currentIndex === activeCarousel.length - 1 && rawOffset < 0;
    const nextOffset = isDraggingPastStart || isDraggingPastEnd ? rawOffset * 0.25 : rawOffset;
    carouselDragOffsetRef.current = nextOffset;
    setCarouselDragOffset(nextOffset);
  };

  const finishCarouselDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!carouselDraggingRef.current) return;
    const currentIndex = carouselIndex % activeCarousel.length;
    const width = carouselViewportRef.current?.clientWidth || 1;
    const threshold = Math.min(120, Math.max(45, width * 0.12));
    const offset = carouselDragOffsetRef.current;

    if (!cancelled && offset <= -threshold && currentIndex < activeCarousel.length - 1) {
      setCarouselIndex(currentIndex + 1);
    } else if (!cancelled && offset >= threshold && currentIndex > 0) {
      setCarouselIndex(currentIndex - 1);
    }

    carouselDraggingRef.current = false;
    carouselDragOffsetRef.current = 0;
    setIsCarouselDragging(false);
    setCarouselDragOffset(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => { carouselHasDraggedRef.current = false; }, 0);
  };

  const preventCarouselClickAfterDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!carouselHasDraggedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    try {
      const savedCart = window.localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        if (Array.isArray(parsedCart)) setCart(parsedCart);
      }
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } finally {
      setIsCartHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isCartHydrated) return;
    if (cart.length > 0) {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } else {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, [cart, isCartHydrated]);

  useEffect(() => {
    setAppliedDiscount(null);
  }, [cart]);

  useEffect(() => {
    const resetCheckoutState = () => {
      setCheckoutPaymentMethod(null);
      try {
        const savedCart = window.localStorage.getItem(CART_STORAGE_KEY);
        const parsedCart = savedCart ? JSON.parse(savedCart) : [];
        setCart(Array.isArray(parsedCart) ? parsedCart : []);
      } catch {
        window.localStorage.removeItem(CART_STORAGE_KEY);
        setCart([]);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resetCheckoutState();
    };

    window.addEventListener('pageshow', resetCheckoutState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pageshow', resetCheckoutState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 金探子隨機出現 (30% 機率)
  useEffect(() => {
    setShowHiddenGem(Math.random() < 0.3);
  }, []);

  // 過濾區域，並過濾金探子方案 (方案層級，不是國家層級)
  const filteredProducts = (selectedCountry
    ? products.filter(p => p.country === selectedCountry)
    : activeRegion === "全部"
      ? products
      : products.filter(p => p.region === activeRegion)
  ).map(p => ({
    ...p,
    plans: p.plans.filter((plan: any) => !plan.isHiddenGem || showHiddenGem)
  })).filter(p => p.plans.length > 0);

  const addToCart = (product: any, plan: any) => {
    const item = { ...product, ...plan, uid: Date.now() };
    setCart([...cart, item]);
    showToast(`✅ 已加入：${product.flag} ${product.country} ${plan.data}`);
  };

  const removeFromCart = (uid: number) => {
    setCart(cart.filter(item => item.uid !== uid));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2500);
  };

  const submitDestinationRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (destinationRequestState === 'submitting') return;
    const country = destinationRequest.replace(/\s+/g, ' ').trim();
    if (country.length < 2) {
      setDestinationRequestState('error');
      setDestinationRequestMessage('請輸入至少 2 個字的國家或地區名稱');
      return;
    }

    const existing = products.find(product => String(product.country || '').trim().toLocaleLowerCase('zh-TW') === country.toLocaleLowerCase('zh-TW'));
    if (existing) {
      setSelectedCountry(existing.country);
      setDestinationRequestState('success');
      setDestinationRequestMessage(`${existing.country}已有方案，已幫你移到商品列表`);
      window.setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      return;
    }

    setDestinationRequestState('submitting');
    setDestinationRequestMessage('');
    try {
      const response = await fetch('/api/destination-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, visitorId: getAnalyticsVisitorId(), website: '' })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '需求送出失敗');
      setDestinationRequestState('success');
      setDestinationRequestMessage(result.duplicate ? '這個需求已經記錄過，謝謝你的提醒' : '已收到需求，我們會評估新增這個目的地');
      setDestinationRequest('');
    } catch (error) {
      setDestinationRequestState('error');
      setDestinationRequestMessage(error instanceof Error ? error.message : '需求送出失敗，請稍後再試');
    }
  };

  useEffect(() => {
    const payment = new URLSearchParams(window.location.search).get('payment');
    if (payment === 'cancelled') {
      showToast('已取消付款，購物車沒有扣款');
      window.history.replaceState({}, '', '/');
    } else if (payment === 'failed') {
      showToast('付款未完成，請重新操作');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);
  const payableTotal = appliedDiscount?.payableTotal ?? cartTotal;
  const discountAmount = appliedDiscount?.discountAmount ?? 0;

  // Check active session on load
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchCustomerProfile(session.user.email);
      }
    };
    checkSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchCustomerProfile(session.user.email);
      } else {
        setUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchCustomerProfile = async (email: string | undefined) => {
    if (!email) return;
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .single();
    
    if (customer) {
      setUser(customer);
    } else {
      // Auto-create customer profile if missing
      const { data: newCustomer } = await supabase
        .from('customers')
        .insert([{ email, token_balance: 0, name: email.split('@')[0] }])
        .select()
        .single();
      setUser(newCustomer);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    showToast("✅ 已登出");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) {
      showToast("❌ 登入失敗: " + error.message);
    } else {
      setIsLoginOpen(false);
      showToast("✅ 登入成功");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authPassword !== authConfirmPassword) {
      showToast("❌ 兩次密碼輸入不一致");
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
    });
    if (error) {
      showToast("❌ 註冊失敗: " + error.message);
    } else {
      // 這裡如果 Supabase 開啟了 Email Confirm，會需要收信驗證。
      // 開發期建議到 Supabase 關閉 Confirm email 功能。
      showToast("✅ 註冊成功，請登入測試。");
      // 如果有填推薦碼，嘗試兑換
      if (authPromoCode.trim()) {
        try {
          const promoRes = await authenticatedFetch('/api/promo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: authPromoCode.trim() }),
          });
          const promoJson = await promoRes.json();
          if (promoRes.ok && promoJson.success) {
            showToast(`✅ 註冊成功！推薦碼已兑換 NT$${promoJson.addedTokens}`);
          } else {
            showToast("✅ 註冊成功！推薦碼無效或已過期，但不影響註冊");
          }
        } catch {
          showToast("✅ 註冊成功！推薦碼兑換失敗，但不影響註冊");
        }
      }
      setIsRegisterMode(false);
      setAuthConfirmPassword("");
      setAuthPromoCode(""); // 清空
    }
  };

  const completeOrder = async () => {
    if (tokenCheckoutLock.current) return;
    if (!user) {
      showToast("⚠️ 請先登入");
      setIsCheckoutOpen(false);
      setIsLoginOpen(true);
      return;
    }

    tokenCheckoutLock.current = true;
    setIsTokenCheckoutSubmitting(true);
    showToast("⏳ 正在處理訂單...");
    
    try {
      const res = await authenticatedFetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.name || user.email.split('@')[0],
          productIds: cart.map(item => item.id),
          useTokens: true,
          paymentMethod: 'TOKENS',
          discountCode: appliedDiscount?.code || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '購買失敗');
      }

      setIsCheckoutOpen(false);
      setIsSuccessOpen(true);
      setCart([]);
      
      // 更新前台餘額顯示
      await fetchCustomerProfile(user.email);
    } catch (err: any) {
      showToast("❌ " + err.message);
    } finally {
      tokenCheckoutLock.current = false;
      setIsTokenCheckoutSubmitting(false);
    }
  };

  const applyCheckoutCode = async () => {
    if (!user) {
      showToast("請先登入再使用折扣碼");
      setIsLoginOpen(true);
      return;
    }
    if (!checkoutCode.trim() || isApplyingDiscount) return;
    setIsApplyingDiscount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('登入狀態已過期，請重新登入');
      const response = await fetch('/api/checkout/discount', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          productIds: cart.map(item => item.id),
          code: checkoutCode
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '折扣碼無法使用');
      setAppliedDiscount(result.quote);
      setCheckoutCode(result.quote.code);
      showToast(`已套用折扣碼，折抵 NT$${result.quote.discountAmount}`);
    } catch (error) {
      setAppliedDiscount(null);
      showToast(`折扣碼錯誤：${error instanceof Error ? error.message : '請重新輸入'}`);
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  const startEcpayCheckout = async (paymentMethod: EcpayPaymentMethod) => {
    if (!user) {
      showToast("請先登入再使用線上付款");
      setIsCheckoutOpen(false);
      setIsLoginOpen(true);
      return;
    }
    if (checkoutPaymentMethod || cart.length === 0) return;

    const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
    const isStandaloneWebApp = window.matchMedia('(display-mode: standalone)').matches
      || standaloneNavigator.standalone === true;
    const paymentWindowName = 'roamLinkEcpayPayment';
    const paymentWindow = isStandaloneWebApp ? window.open('', paymentWindowName) : null;

    if (isStandaloneWebApp && !paymentWindow) {
      showToast('請允許彈出式視窗，才能前往綠界付款');
      return;
    }

    if (paymentWindow) {
      try {
        paymentWindow.document.title = '正在前往綠界付款';
        paymentWindow.document.body.innerHTML = `
          <main style="min-height:100vh;display:grid;place-items:center;background:#0d0d1a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
            <div style="text-align:center">
              <div style="width:34px;height:34px;margin:0 auto 18px;border:3px solid rgba(255,255,255,.2);border-top-color:#55c875;border-radius:50%;animation:spin .8s linear infinite"></div>
              <div style="font-size:16px;font-weight:700">${paymentMethod === 'ApplePay' ? '正在前往 Apple Pay' : paymentMethod === 'BARCODE' ? '正在產生超商繳費條碼' : '正在連線綠界安全付款'}</div>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
          </main>`;
      } catch {
        // Reused cross-origin payment windows cannot be restyled before submission.
      }
    }

    setCheckoutPaymentMethod(paymentMethod);
    showToast(paymentMethod === 'ApplePay'
      ? '正在前往 Apple Pay...'
      : paymentMethod === 'BARCODE'
        ? '正在產生超商繳費條碼...'
        : '正在連線至綠界安全付款頁...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('登入狀態已過期，請重新登入');

      const response = await fetch('/api/ecpay/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          productIds: cart.map(item => item.id),
          paymentMethod,
          discountCode: appliedDiscount?.code || undefined
        })
      });
      const result = await response.json();
      if (!response.ok || !result.action || !result.fields) {
        throw new Error(result.error || '無法建立綠界付款');
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = result.action;
      form.style.display = 'none';
      if (paymentWindow) form.target = paymentWindowName;
      Object.entries(result.fields as Record<string, string>).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      if (paymentWindow) {
        setIsCheckoutOpen(false);
        setCheckoutPaymentMethod(null);
      }
    } catch (error) {
      paymentWindow?.close();
      showToast(`付款建立失敗：${error instanceof Error ? error.message : '請稍後再試'}`);
      setCheckoutPaymentMethod(null);
    }
  };

  return (
    <div className="min-h-screen relative z-10">
      {/* 導覽列 */}
      <nav className="sticky top-0 z-50 bg-[#0D0D1A]/90 px-4 py-3 backdrop-blur-md border-b border-white/5 md:flex md:items-center md:justify-between md:px-6 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" aria-label="一飛通全球漫遊 FirstRoamLink 首頁" className="min-w-0 font-display font-extrabold leading-tight tracking-normal">
            <span className="block text-[13px] text-white md:text-base">一飛通全球漫遊</span>
            <span className="block text-sm bg-gradient-to-br from-coral to-yellow text-transparent bg-clip-text md:text-lg">FirstRoamLink</span>
          </Link>
          <div className="flex items-center gap-2 md:hidden">
            {user ? (
              <>
                <a href="/member" className="flex h-10 items-center gap-2 rounded-md border border-yellow/30 bg-yellow/10 px-2.5" aria-label={`會員中心，餘額 NT$${user.token_balance}`}>
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-coral to-yellow text-[11px] font-black text-dark">
                    {user.name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-xs font-black text-yellow">${user.token_balance}</span>
                </a>
                <button onClick={handleLogout} aria-label="登出" title="登出" className="grid h-10 w-9 place-items-center rounded-md border border-white/10 text-white/55">
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <button onClick={() => setIsLoginOpen(true)} aria-label="登入或註冊" className="grid h-10 w-10 place-items-center rounded-md bg-white/10 text-white">
                <User size={18} />
              </button>
            )}
            <button onClick={() => setIsCartOpen(true)} aria-label={`購物車，共 ${cart.length} 件`} className="relative grid h-10 w-11 place-items-center rounded-md bg-coral text-white">
              <ShoppingCart size={19} />
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-yellow px-1 text-[11px] font-black text-dark">{cart.length}</span>
            </button>
          </div>
        </div>
        <ul className="hidden md:flex gap-8">
          <li><a href="#" className="text-muted hover:text-text-main transition-colors text-sm font-medium">首頁</a></li>
          <li><a href="#products" className="text-muted hover:text-text-main transition-colors text-sm font-medium">eSIM 方案</a></li>
          <li><Link href="/shop" className="text-muted hover:text-text-main transition-colors text-sm font-medium">一飛通商城</Link></li>
        </ul>
        <div className="hidden items-center gap-4 md:flex">
            {user ? (
                <div className="flex items-center gap-3">
                    <a 
                      href="/member"
                      className="flex items-center gap-2.5 bg-gradient-to-r from-yellow/15 to-coral/10 hover:from-yellow/25 hover:to-coral/20 border border-yellow/30 hover:border-yellow/50 px-4 py-2 rounded-full transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_15px_rgba(245,189,97,0.2)] group"
                    >
                      <div className="w-7 h-7 bg-gradient-to-br from-coral to-yellow rounded-full flex items-center justify-center text-xs font-black text-dark shadow-md">
                        {user.name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="text-left">
                        <div className="text-[10px] text-white/50 leading-tight">會員中心</div>
                        <div className="text-sm font-black text-yellow leading-tight">NT$ {user.token_balance}</div>
                      </div>
                    </a>
                    <button onClick={handleLogout} className="text-xs text-muted hover:text-white border border-white/10 hover:border-white/30 px-2.5 py-1.5 rounded-full transition-colors">登出</button>
                </div>
            ) : (
                <button 
                  onClick={() => setIsLoginOpen(true)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-all text-white px-4 py-2 rounded-full font-bold text-sm"
                >
                  <User size={18} />
                  <span className="hidden sm:inline">登入 / 註冊</span>
                </button>
            )}

            <button 
            onClick={() => setIsCartOpen(true)}
            className="flex items-center gap-2 bg-coral hover:bg-coral/90 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(255,78,106,0.4)] transition-all text-white px-4 py-2 rounded-full font-bold text-sm"
            >
            <ShoppingCart size={18} />
            <span className="hidden sm:inline">購物車</span>
            <span className="bg-yellow text-dark w-5 h-5 rounded-full flex items-center justify-center text-xs font-black">
                {cart.length}
            </span>
            </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:hidden">
          <a href="#products" className="flex h-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-sm font-bold text-white/75">eSIM 方案</a>
          <Link href="/shop" className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#168b55] text-sm font-bold text-white">
            <ShoppingBag size={17} />一飛通商城
          </Link>
        </div>
      </nav>

      {/* 首頁廣告輪播；未設定圖片時保留原本的文字首頁。 */}
      {currentCarouselBanner ? (
        <section className="w-full pb-10 sm:pb-14">
          <h1 className="sr-only">{siteSettings.hero_title}</h1>
          <div
            ref={carouselViewportRef}
            onPointerDown={handleCarouselPointerDown}
            onPointerMove={handleCarouselPointerMove}
            onPointerUp={event => finishCarouselDrag(event)}
            onPointerCancel={event => finishCarouselDrag(event, true)}
            onClickCapture={preventCarouselClickAfterDrag}
            className={`relative aspect-video w-full select-none overflow-hidden bg-[#080812] ${activeCarousel.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
            style={{ touchAction: 'pan-y' }}
          >
            <div
              className="flex h-full"
              style={{
                transform: `translate3d(calc(-${(carouselIndex % activeCarousel.length) * 100}% + ${carouselDragOffset}px), 0, 0)`,
                transition: isCarouselDragging ? 'none' : 'transform 500ms ease-out',
                willChange: 'transform'
              }}
            >
              {activeCarousel.map((banner, index) => (
                <div key={banner.id} className="relative h-full w-full shrink-0">
                  {banner.link_url ? (
                    <a href={banner.link_url} className="absolute inset-0 block">
                      <Image
                        src={banner.image_url}
                        alt={banner.alt_text}
                        fill
                        priority={index === 0}
                        draggable={false}
                        sizes="100vw"
                        className="object-cover"
                      />
                    </a>
                  ) : (
                    <Image
                      src={banner.image_url}
                      alt={banner.alt_text}
                      fill
                      priority={index === 0}
                      draggable={false}
                      sizes="100vw"
                      className="object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {activeCarousel.length > 1 && (
            <div className="flex h-10 items-center justify-center gap-2 bg-[#080812]">
              {activeCarousel.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => setCarouselIndex(index)}
                  aria-label={`顯示第 ${index + 1} 張廣告`}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${index === carouselIndex % activeCarousel.length ? 'bg-coral' : 'bg-white/35 hover:bg-white/70'}`}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="px-6 pb-16 pt-20 text-center">
          <div className="mb-6 inline-block rounded-full border border-yellow bg-yellow/15 px-4 py-1.5 text-sm font-bold text-yellow animate-fade-in-up">
            {siteSettings.hero_badge}
          </div>
          <h1 className="mb-6 text-4xl font-black leading-tight animate-fade-in-up animation-delay-100 md:text-6xl">
            <span className="bg-gradient-to-br from-coral via-yellow to-cyan bg-clip-text text-transparent">{siteSettings.hero_title}</span>
          </h1>
          <p className="mx-auto mb-8 max-w-lg text-lg text-muted animate-fade-in-up animation-delay-200">
            {siteSettings.hero_subtitle}
          </p>
        </section>
      )}

      {/* 商品區塊 */}
      <section id="products" className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
          <h2 className="text-3xl font-black">{siteSettings.section_title}</h2>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeTab === 'plans'
                  ? 'bg-coral/20 border-coral text-coral border'
                  : 'bg-transparent border-white/10 text-muted border hover:bg-white/5'
              }`}
            >
              eSIM 方案
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeTab === 'guide'
                  ? 'bg-coral/20 border-coral text-coral border'
                  : 'bg-transparent border-white/10 text-muted border hover:bg-white/5'
              }`}
            >
              使用說明
            </button>
            <a
              href="/games"
              className="px-4 py-1.5 rounded-full text-sm font-medium bg-transparent border-white/10 text-muted border hover:bg-white/5 transition-all"
            >
              🎮 旅遊玩伴
            </a>
          </div>
        </div>

        {activeTab === 'guide' ? (
          <div className="bg-card-bg border border-white/10 rounded-3xl p-8 md:p-12">
            {siteSettings.usage_guide ? (
              <div className="max-w-none text-muted leading-relaxed [&_a]:text-cyan [&_a]:underline [&_a]:underline-offset-4 [&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-white [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-white [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-md [&_li]:ml-5 [&_li]:list-disc [&_p]:my-3 [&_strong]:font-bold [&_strong]:text-white [&_ul]:my-3">
                <Markdown remarkPlugins={[remarkGfm]}>
                  {siteSettings.usage_guide}
                </Markdown>
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">📖</p>
                <p className="text-muted text-lg">使用說明即將推出</p>
              </div>
            )}
          </div>
        ) : (
        <>
        <div className="flex flex-wrap gap-2 justify-center mb-8">
            {regions.map(region => (
              <button
                key={region}
                onClick={() => {
                  setSelectedCountry('');
                  setActiveRegion(region);
                }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  !selectedCountry && activeRegion === region
                    ? 'bg-coral/20 border-coral text-coral border' 
                    : 'bg-transparent border-white/10 text-muted border hover:bg-white/5'
                }`}
              >
                {region}
              </button>
            ))}
        </div>
        {selectedCountry && <div className="mb-7 flex items-center justify-center gap-3 text-sm"><span className="text-white/55">正在顯示：<strong className="text-cyan">{selectedCountry} eSIM</strong></span><button type="button" onClick={() => setSelectedCountry('')} className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5">查看全部</button></div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {productsLoading ? (
            <div className="col-span-full text-center py-20">
              <div className="inline-block w-8 h-8 border-2 border-white/20 border-t-coral rounded-full animate-spin mb-4"></div>
              <p className="text-muted">載入方案中...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-20">
              <p className="text-4xl mb-4">📡</p>
              <p className="text-muted text-lg">暫無方案，敬請期待</p>
            </div>
          ) : filteredProducts.map((product, idx) => {
            const isExpanded = expandedCountries.has(product.country);
            const visiblePlans = isExpanded ? product.plans : product.plans.slice(0, 3);
            const hasMore = product.plans.length > 3;

            return (
              <div key={idx} className="bg-card-bg border border-white/10 rounded-3xl overflow-hidden hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)] hover:border-white/20 transition-all group">
                <div className="p-6 relative">
                  <span className="text-5xl block mb-2">{product.flag}</span>
                  <h3 className="text-xl font-bold">{product.country}</h3>
                  <p className="text-muted text-sm">{product.region}</p>
                  {product.totalSales > 0 && (
                    <div className="absolute top-6 right-6 bg-yellow text-dark text-xs font-black px-2 py-1 rounded-full">
                      熱銷
                    </div>
                  )}
                </div>
                <div className="px-6 pb-6 flex flex-col gap-3">
                  {visiblePlans.map((plan: any, pIdx: number) => {
                    const planKey = `${product.country}|${plan.data}`;
                    const selIdx = selectedDays[planKey] ?? 0;
                    const currentOption = plan.options[selIdx] || plan.options[0];
                    const hasMultiple = plan.options.length > 1;

                    return (
                      <div key={pIdx} className={`rounded-xl p-3 transition-colors ${plan.isHiddenGem ? 'bg-yellow-500/5 border border-yellow-500/30 hover:border-yellow-500/50' : 'bg-white/5 border border-white/5 hover:border-coral/50'}`}>
                        <div className="flex items-start justify-between mb-2 gap-3">
                          <div className="min-w-0 font-bold text-sm flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="flex items-center gap-1.5">
                              {plan.isHiddenGem && <span className="animate-bounce">✨</span>}
                              <span>{plan.data}</span>
                            </span>
                            {currentOption.hotspot_sharing && (
                              <span className="max-w-full truncate text-cyan font-medium" title={currentOption.hotspot_sharing}>
                                {shortenHotspotText(currentOption.hotspot_sharing)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="font-black text-coral">
                              <span className="text-[10px] text-muted font-normal mr-0.5">NT$</span>
                              {currentOption.price}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(product, {
                                  id: currentOption.id,
                                  data: plan.data,
                                  hotspot_sharing: currentOption.hotspot_sharing,
                                  days: `${currentOption.days}天`,
                                  price: currentOption.price
                                });
                              }}
                              className="bg-coral text-white w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#ff2d4f] hover:scale-110 transition-all"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {hasMultiple ? (
                          <div className="flex flex-wrap gap-1.5">
                            {plan.options.map((opt: any, oIdx: number) => (
                              <button
                                key={oIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDays(prev => ({ ...prev, [planKey]: oIdx }));
                                }}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                                  oIdx === selIdx
                                    ? 'bg-coral text-white'
                                    : 'bg-white/5 text-muted hover:bg-white/10'
                                }`}
                              >
                                {opt.days}天
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted text-xs">{currentOption.days}天</div>
                        )}
                      </div>
                    );
                  })}

                  {hasMore && (
                    <button
                      onClick={() => {
                        setExpandedCountries(prev => {
                          const next = new Set(prev);
                          if (next.has(product.country)) {
                            next.delete(product.country);
                          } else {
                            next.add(product.country);
                          }
                          return next;
                        });
                      }}
                      className="text-white/40 hover:text-white/60 text-xs font-medium text-center py-2 transition-colors"
                    >
                      {isExpanded ? '▲ 收起' : `▼ 顯示更多方案 (${product.plans.length - 3})`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
        )}
      </section>

      <section className="border-y border-white/10 bg-[#111827] px-6 py-12" aria-labelledby="travel-esim-heading">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.35fr_0.65fr] md:items-center">
          <div>
            <p className="mb-3 text-xs font-bold text-cyan">一飛通全球漫遊 FirstRoamLink</p>
            <h2 id="travel-esim-heading" className="text-2xl font-black text-white md:text-3xl">熱門旅遊 eSIM 與出國上網方案</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60">
              正在找日本 eSIM、韓國 eSIM 或 KDDI 原生網路方案？一飛通提供日本 eSIM 吃到飽、每日流量與總量型方案，
              也有韓國、泰國、越南、中國、中港澳與台灣等目前上架地區。線上選購後即可取得安裝資訊，出國落地快速連線。
            </p>
          </div>
          <div className="border-l-0 border-white/10 md:border-l md:pl-8">
            <h3 className="text-sm font-bold text-white">熱門搜尋</h3>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {ESIM_DESTINATIONS.slice(0, 6).map(destination => (
                <Link key={destination.slug} href={getEsimDestinationHref(destination)} className="border-b border-white/10 pb-2 text-white/55 hover:border-cyan hover:text-cyan">
                  {destination.name}
                </Link>
              ))}
            </div>
            <Link href="/esim" className="mt-5 inline-flex text-sm font-bold text-cyan hover:text-white">查看全部 eSIM 目的地 →</Link>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0f1522] px-6 py-12" aria-labelledby="destination-request-heading">
        <div className="mx-auto grid max-w-6xl gap-7 md:grid-cols-[minmax(0,0.8fr)_minmax(360px,1.2fr)] md:items-end">
          <div>
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-md bg-cyan/10 text-cyan"><MapPin size={20} /></div>
            <h2 id="destination-request-heading" className="text-2xl font-black text-white">找不到你要的國家？</h2>
            <p className="mt-3 text-sm leading-7 text-white/50">在這邊輸入你想去的國家或地區，我們會參考需求評估新增方案。</p>
          </div>
          <form onSubmit={submitDestinationRequest} className="w-full">
            <label htmlFor="destination-request" className="sr-only">想去的國家或地區</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="destination-request"
                type="text"
                value={destinationRequest}
                onChange={event => {
                  setDestinationRequest(event.target.value.slice(0, 40));
                  if (destinationRequestState !== 'submitting') {
                    setDestinationRequestState('idle');
                    setDestinationRequestMessage('');
                  }
                }}
                maxLength={40}
                autoComplete="off"
                placeholder="例如：冰島、摩洛哥"
                className="h-12 min-w-0 flex-1 rounded-md border border-white/12 bg-[#171c29] px-4 text-base text-white outline-none placeholder:text-white/25 focus:border-cyan/60 focus:ring-2 focus:ring-cyan/15"
              />
              <button type="submit" disabled={destinationRequestState === 'submitting'} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-cyan px-5 text-sm font-black text-[#07141b] hover:bg-white disabled:cursor-wait disabled:opacity-50">
                <Send size={16} />{destinationRequestState === 'submitting' ? '送出中' : '送出需求'}
              </button>
            </div>
            <p aria-live="polite" className={`mt-3 min-h-5 text-sm ${destinationRequestState === 'error' ? 'text-red-300' : destinationRequestState === 'success' ? 'text-emerald-300' : 'text-white/35'}`}>
              {destinationRequestMessage || '不需要登入即可送出。'}
            </p>
          </form>
        </div>
      </section>

      {/* 頁尾聯絡資訊 */}
      <footer className="border-t border-white/10 bg-[#0D0D1A]/80 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <div>
            <div className="font-display text-2xl font-extrabold bg-gradient-to-br from-coral to-yellow text-transparent bg-clip-text mb-2">
              Roam Link.
            </div>
            <p className="text-sm text-muted max-w-md">{siteSettings.contact_note}</p>
          </div>
          <div className="text-left md:text-right">
            <h2 className="text-sm font-bold text-white mb-3">{siteSettings.contact_title}</h2>
            <div className="flex flex-col gap-2 text-sm">
              {siteSettings.contact_items.map((item) => (
                item.href ? (
                  <a key={item.id} href={item.href} className="text-cyan hover:text-white transition-colors">
                    {item.label}：{item.value}
                  </a>
                ) : (
                  <p key={item.id} className="text-cyan">
                    {item.label}：{item.value}
                  </p>
                )
              ))}
            </div>
            <a
              href="https://lin.ee/Td0EgHE"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="加入一飛通 LINE 好友"
              className="mt-4 inline-flex min-h-11 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#06c755]"
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
            <div className="mt-5 border-t border-white/10 pt-4">
              <Link href="/company-discount" className="inline-flex min-h-11 items-center text-sm font-bold text-white/60 transition-colors hover:text-cyan">
                查詢企業優惠
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* 登入 / 註冊對話框 */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex justify-center items-center px-4">
          <div className="bg-[#1A1A2E] w-full max-w-sm rounded-3xl p-8 shadow-2xl relative">
            <button onClick={() => { setIsLoginOpen(false); setIsForgotPassword(false); }} className="absolute top-4 right-4 bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-white">✕</button>
            
            <h3 className="text-2xl font-black mb-6 text-center">{isRegisterMode ? '建立新帳號' : '會員登入'}</h3>
            
            <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-2">電子郵件</label>
                <input required type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="example@mail.com" className="w-full bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan" />
              </div>
              <div>
                <label className="block text-sm text-muted mb-2">密碼</label>
                <input required type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" className="w-full bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan" />
              </div>

              {isRegisterMode && (
                <>
                <div>
                  <label className="block text-sm text-muted mb-2">確認密碼</label>
                  <input required type="password" value={authConfirmPassword} onChange={(e) => setAuthConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan" />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-2">推薦碼（選填）</label>
                  <input type="text" value={authPromoCode} onChange={(e) => setAuthPromoCode(normalizeReferralCode(e.target.value))} placeholder="輸入推薦碼可獲得優惠" className="w-full bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan font-mono placeholder:font-sans" />
                </div>
                </>
              )}
              
              {!isRegisterMode && !isForgotPassword && (
                  <div className="text-right">
                      <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs text-cyan hover:underline">忘記密碼？</button>
                  </div>
              )}

              {!isForgotPassword && (
                <button type="submit" className="w-full bg-gradient-to-r from-coral to-yellow text-dark font-black py-3 rounded-xl hover:-translate-y-1 transition-all mt-4">
                  {isRegisterMode ? '註冊' : '登入'}
                </button>
              )}
            </form>

            {/* 忘記密碼表單 */}
            {isForgotPassword && (
              <div className="mt-2">
                <p className="text-sm text-muted mb-4">輸入您的電子郵件，我們將寄送重設密碼連結給您。</p>
                <button 
                  type="button"
                  onClick={async () => {
                    if (!authEmail) { showToast('⚠️ 請先輸入 Email'); return; }
                    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
                      redirectTo: `${window.location.origin}/auth/reset-password`
                    });
                    if (error) {
                      showToast('❌ ' + error.message);
                    } else {
                      showToast('✅ 重設密碼信件已寄出，請檢查信箱');
                      setIsForgotPassword(false);
                    }
                  }}
                  className="w-full bg-gradient-to-r from-coral to-yellow text-dark font-black py-3 rounded-xl hover:-translate-y-1 transition-all"
                >
                  寄送重設密碼信
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsForgotPassword(false)} 
                  className="w-full text-sm text-muted hover:text-white mt-3 py-2"
                >
                  返回登入
                </button>
              </div>
            )}

            {!isForgotPassword && (
              <div className="mt-6 text-center text-sm text-muted">
                {isRegisterMode ? '已經有帳號了？' : '還沒有帳號？'}
                <button 
                  onClick={() => setIsRegisterMode(!isRegisterMode)} 
                  className="text-cyan font-bold ml-2 hover:underline"
                >
                  {isRegisterMode ? '返回登入' : '立即註冊'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      

      {/* 購物車側邊欄 (Overlay) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="bg-[#1A1A2E] w-full max-w-md h-full shadow-2xl p-6 flex flex-col animate-slide-in-right">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black">購物車 ({cart.length})</h3>
              <button onClick={() => setIsCartOpen(false)} className="text-muted hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2">
              {cart.length === 0 ? (
                <div className="text-center text-muted mt-20">
                  <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                  <p>購物車是空的</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.uid} className="bg-card-bg p-4 rounded-2xl flex items-center justify-between border border-white/5">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{item.flag}</span>
                      <div>
                        <div className="font-bold">{item.country} {item.data}</div>
                        {item.hotspot_sharing && <div className="text-sm text-cyan">{item.hotspot_sharing}</div>}
                        <div className="text-sm text-muted">{item.days}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="font-black text-coral">NT${item.price}</div>
                      <button onClick={() => removeFromCart(item.uid)} className="text-muted hover:text-white">✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="pt-6 border-t border-white/10 mt-4">
                <div className="flex justify-between items-center mb-6 text-lg">
                  <span className="text-muted">合計</span>
                  <span className="text-2xl font-black text-yellow">NT${cartTotal}</span>
                </div>
                <button 
                  onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                  className="w-full bg-gradient-to-r from-coral to-yellow text-dark font-black py-4 rounded-xl hover:-translate-y-1 transition-all"
                >
                  前往結帳 →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 結帳對話框 */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex justify-center items-end md:items-center">
          <div className="bg-[#1A1A2E] w-full max-w-md rounded-t-3xl md:rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsCheckoutOpen(false)} className="absolute top-4 right-4 bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-white">✕</button>
            
            <h3 className="text-xl font-black mb-6">確認訂單</h3>
            
            <div className="bg-card-bg border border-white/10 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-muted">購買項目</span>
                <span className="font-bold">{cart.length} 件</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-muted">小計</span>
                <span className="font-bold">NT${cartTotal}</span>
              </div>
              <div className="mb-4 border-b border-white/5 pb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={checkoutCode}
                    onChange={(e) => setCheckoutCode(normalizeReferralCode(e.target.value))}
                    placeholder="折扣碼 / 推薦碼"
                    className="min-w-0 flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-cyan font-mono placeholder:font-sans"
                  />
                  <button
                    type="button"
                    onClick={applyCheckoutCode}
                    disabled={isApplyingDiscount || !checkoutCode.trim()}
                    className="bg-cyan/20 text-cyan hover:bg-cyan/30 disabled:bg-white/5 disabled:text-white/30 disabled:cursor-not-allowed px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                  >
                    {isApplyingDiscount ? '套用中' : '套用'}
                  </button>
                </div>
                {appliedDiscount && (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between text-emerald-300">
                      <span>{appliedDiscount.label || '折扣碼'} · {appliedDiscount.code}</span>
                      <span>-NT${discountAmount}</span>
                    </div>
                    <div className="flex justify-between text-yellow font-black">
                      <span>實付金額</span>
                      <span>NT${payableTotal}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {user ? (
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-muted">目前儲值金餘額</span>
                    <span className="font-bold text-yellow">NT${user.token_balance}</span>
                 </div>
              ) : (
                  <div className="text-sm text-coral">請先登入以使用儲值金付款</div>
              )}
            </div>

            {user && user.token_balance >= payableTotal ? (
                <button onClick={completeOrder} disabled={isTokenCheckoutSubmitting} className="w-full bg-gradient-to-r from-yellow to-[#f5d061] text-dark font-black py-4 rounded-xl hover:-translate-y-1 disabled:opacity-60 disabled:cursor-wait disabled:translate-y-0 transition-all flex items-center justify-center gap-2">
                    <Zap size={20} />
                    {isTokenCheckoutSubmitting ? '儲值金扣款處理中...' : `使用儲值金扣款 (NT${payableTotal})`}
                </button>
            ) : (
                <button disabled className="w-full bg-white/10 text-white/50 font-black py-4 rounded-xl cursor-not-allowed flex items-center justify-center gap-2 mb-3">
                    <Zap size={20} />
                    儲值金餘額不足
                </button>
            )}

            <div className="relative flex py-5 items-center">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-muted text-xs">或使用其他付款方式</span>
                <div className="flex-grow border-t border-white/10"></div>
            </div>

            {isApplePayAvailable && (
              <button
                onClick={() => startEcpayCheckout('ApplePay')}
                disabled={checkoutPaymentMethod !== null}
                aria-label={`Apple Pay 付款 NT$${payableTotal}`}
                className="w-full h-12 bg-black border border-white/20 text-white rounded-xl hover:bg-[#171717] disabled:bg-white/10 disabled:text-white/40 disabled:cursor-wait transition-colors flex items-center justify-center mb-3"
              >
                <span className="text-[22px] leading-none font-semibold tracking-normal" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                  {checkoutPaymentMethod === 'ApplePay' ? '正在前往 Apple Pay...' : ` Pay NT$${payableTotal}`}
                </span>
              </button>
            )}

            <button
              onClick={() => startEcpayCheckout('BARCODE')}
              disabled={checkoutPaymentMethod !== null}
              className="w-full bg-[#168b55] border border-emerald-300/20 text-white font-bold py-3 rounded-xl hover:bg-[#1a9d62] disabled:bg-white/10 disabled:text-white/40 disabled:cursor-wait transition-colors flex items-center justify-center gap-2 mb-3"
            >
              <Barcode size={19} />
              {checkoutPaymentMethod === 'BARCODE' ? '正在產生條碼...' : `超商條碼付款 (NT$${payableTotal})`}
            </button>

            <button
              onClick={() => startEcpayCheckout('Credit')}
              disabled={checkoutPaymentMethod !== null}
              className="w-full bg-[#2f63e9] border border-blue-300/20 text-white font-bold py-3 rounded-xl hover:bg-[#3b70f1] disabled:bg-white/10 disabled:text-white/40 disabled:cursor-wait transition-all flex items-center justify-center gap-2"
            >
              <CreditCard size={18} />
              {checkoutPaymentMethod === 'Credit' ? '正在前往綠界...' : `信用卡付款 (NT$${payableTotal})`}
            </button>
          </div>
        </div>
      )}

      {/* 成功畫面 */}
      {isSuccessOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex justify-center items-center">
          <div className="bg-[#1A1A2E] w-full max-w-md rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-20 h-20 bg-green/20 text-green rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
              ✓
            </div>
            <h3 className="text-2xl font-black mb-2">訂購成功！</h3>
            <p className="text-muted">您可以在會員中心查看訂單。若 eSIM 尚未配發，會先顯示處理中，完成後即可安裝或顯示 QR Code。</p>
            <div className="my-5 border-l-2 border-yellow bg-yellow/5 px-4 py-3 text-left">
              <p className="flex items-center gap-2 font-bold text-yellow"><Wifi size={17} /> 請於啟用日前或旅程出發前完成安裝</p>
              <p className="mt-1 text-sm leading-6 text-white/60">安裝前請先連接穩定的 Wi-Fi 或行動網路，安裝過程請勿中斷連線。最晚安裝日可在會員中心查看。</p>
            </div>
            <a href="/member" className="inline-block bg-gradient-to-r from-coral to-yellow text-dark font-black py-3 px-8 rounded-full hover:-translate-y-1 transition-all">
              前往會員中心查看
            </a>
          </div>
        </div>
      )}

      {/* 吐司通知 */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-dark px-6 py-3 rounded-full font-bold shadow-2xl z-[300] animate-fade-in-up">
          {toastMsg}
        </div>
      )}

    </div>
  );
}
