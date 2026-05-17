"use client";

import { useState, useEffect } from "react";
import { ShoppingCart, Search, Globe, Zap, CreditCard, ChevronDown, X, User } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [activeRegion, setActiveRegion] = useState("全部");
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  // TopUp modal moved to /member
  const [toastMsg, setToastMsg] = useState("");
  
  // 模擬登入狀態
  const [user, setUser] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");

  // 從資料庫動態載入商品
  const [products, setProducts] = useState<any[]>([]);
  const [regions, setRegions] = useState<string[]>(["全部", "亞洲", "歐洲", "美洲", "大洋洲"]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
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

  const filteredProducts = activeRegion === "全部" 
    ? products 
    : products.filter(p => p.region === activeRegion);

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

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

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
      setIsRegisterMode(false);
      setAuthConfirmPassword(""); // 清空
    }
  };

  const completeOrder = async () => {
    if (!user) {
      showToast("⚠️ 請先登入");
      setIsCheckoutOpen(false);
      setIsLoginOpen(true);
      return;
    }

    showToast("⏳ 正在處理訂單...");
    
    try {
      // 由於購物車可能有多個商品，我們逐一呼叫 API
      for (const item of cart) {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            name: user.name || user.email.split('@')[0],
            productId: item.id,
            useTokens: true,
            paymentMethod: 'TOKENS'
          })
        });
        
        const data = await res.json();
        if (!res.ok) {
           throw new Error(data.error || '購買失敗');
        }
      }

      setIsCheckoutOpen(false);
      setIsSuccessOpen(true);
      setCart([]);
      
      // 更新前台餘額顯示
      await fetchCustomerProfile(user.email);
    } catch (err: any) {
      showToast("❌ " + err.message);
    }
  };

  return (
    <div className="min-h-screen relative z-10">
      {/* 導覽列 */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0D0D1A]/85 backdrop-blur-md border-b border-white/5">
        <div className="font-display text-2xl font-extrabold bg-gradient-to-br from-coral to-yellow text-transparent bg-clip-text">
          Roam Link.
        </div>
        <ul className="hidden md:flex gap-8">
          <li><a href="#" className="text-muted hover:text-text-main transition-colors text-sm font-medium">首頁</a></li>
          <li><a href="#products" className="text-muted hover:text-text-main transition-colors text-sm font-medium">eSIM 方案</a></li>
        </ul>
        <div className="flex items-center gap-4">
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
      </nav>

      {/* 首頁區塊 */}
      <section className="text-center pt-20 pb-16 px-6">
        <div className="inline-block bg-yellow/15 border border-yellow text-yellow px-4 py-1.5 rounded-full text-sm font-bold mb-6 animate-fade-in-up">
          一飛通全球漫遊 · 2026 全新上線
        </div>
        <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6 animate-fade-in-up animation-delay-100">
          隨時隨地，<br className="md:hidden" />
          <span className="bg-gradient-to-br from-coral via-yellow to-cyan text-transparent bg-clip-text">全球無縫連線</span>
        </h1>
        <p className="text-muted text-lg max-w-lg mx-auto mb-8 animate-fade-in-up animation-delay-200">
          無需拔插實體 SIM 卡。掃描 QR Code 即可開通 190+ 國家的高速網路。
        </p>
      </section>

      {/* 商品區塊 */}
      <section id="products" className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
          <h2 className="text-3xl font-black">熱門目的地</h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {regions.map(region => (
              <button
                key={region}
                onClick={() => setActiveRegion(region)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeRegion === region 
                    ? 'bg-coral/20 border-coral text-coral border' 
                    : 'bg-transparent border-white/10 text-muted border hover:bg-white/5'
                }`}
              >
                {region}
              </button>
            ))}
          </div>
        </div>

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
          ) : filteredProducts.map((product, idx) => (
            <div key={idx} className="bg-card-bg border border-white/10 rounded-3xl overflow-hidden hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)] hover:border-white/20 transition-all cursor-pointer group">
              <div className="p-6 relative">
                <span className="text-5xl block mb-2">{product.flag}</span>
                <h3 className="text-xl font-bold">{product.country}</h3>
                <p className="text-muted text-sm">{product.region}</p>
                <div className="absolute top-6 right-6 bg-yellow text-dark text-xs font-black px-2 py-1 rounded-full">
                  熱銷
                </div>
              </div>
              <div className="px-6 pb-6 flex flex-col gap-3">
                {product.plans.map((plan: any, pIdx: number) => (
                  <div key={pIdx} className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl p-3 hover:border-coral hover:bg-coral/10 transition-colors">
                    <div>
                      <div className="font-bold text-sm">{plan.data}</div>
                      <div className="text-muted text-xs">{plan.days}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-black text-coral">
                        <span className="text-[10px] text-muted font-normal mr-0.5">NT$</span>
                        {plan.price}
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); addToCart(product, plan); }}
                        className="bg-coral text-white w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#ff2d4f] hover:scale-110 transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 登入 / 註冊對話框 */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex justify-center items-center px-4">
          <div className="bg-[#1A1A2E] w-full max-w-sm rounded-3xl p-8 shadow-2xl relative">
            <button onClick={() => setIsLoginOpen(false)} className="absolute top-4 right-4 bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-white">✕</button>
            
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
                <div>
                  <label className="block text-sm text-muted mb-2">確認密碼</label>
                  <input required type="password" value={authConfirmPassword} onChange={(e) => setAuthConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan" />
                </div>
              )}
              
              {!isRegisterMode && (
                  <div className="text-right">
                      <a href="#" className="text-xs text-cyan hover:underline">忘記密碼？</a>
                  </div>
              )}

              <button type="submit" className="w-full bg-gradient-to-r from-coral to-yellow text-dark font-black py-3 rounded-xl hover:-translate-y-1 transition-all mt-4">
                {isRegisterMode ? '註冊' : '登入'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-muted">
              {isRegisterMode ? '已經有帳號了？' : '還沒有帳號？'}
              <button 
                onClick={() => setIsRegisterMode(!isRegisterMode)} 
                className="text-cyan font-bold ml-2 hover:underline"
              >
                {isRegisterMode ? '返回登入' : '立即註冊'}
              </button>
            </div>
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
              <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-4">
                <span className="text-muted">小計</span>
                <span className="font-bold">NT${cartTotal}</span>
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

            {user && user.token_balance >= cartTotal ? (
                <button onClick={completeOrder} className="w-full bg-gradient-to-r from-yellow to-[#f5d061] text-dark font-black py-4 rounded-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2">
                    <Zap size={20} />
                    使用儲值金扣款 (NT${cartTotal})
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

            <button className="w-full bg-card-bg border border-white/20 text-white font-bold py-3 rounded-xl hover:bg-white/5 transition-all flex items-center justify-center gap-2">
              <CreditCard size={18} />
              信用卡付款 (即將推出)
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
            <p className="text-muted mb-8">您可以在會員中心查看您的 eSIM QR Code 與安裝說明。</p>
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
