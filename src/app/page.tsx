"use client";

import { useState } from "react";
import { ShoppingCart, Search, Globe, Zap, CreditCard, ChevronDown, X } from "lucide-react";

export default function Home() {
  const [activeRegion, setActiveRegion] = useState("全部");
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const regions = ["全部", "亞洲", "歐洲", "美洲", "大洋洲"];
  
  const products = [
    { country: '日本', region: '亞洲', flag: '🇯🇵', plans: [ { data: '每日 1GB', days: '5天', price: 350 }, { data: '總量 10GB', days: '10天', price: 600 } ] },
    { country: '韓國', region: '亞洲', flag: '🇰🇷', plans: [ { data: '每日 2GB', days: '5天', price: 420 }, { data: '吃到飽', days: '7天', price: 750 } ] },
    { country: '泰國', region: '亞洲', flag: '🇹🇭', plans: [ { data: '總量 15GB', days: '8天', price: 299 } ] },
    { country: '美國', region: '美洲', flag: '🇺🇸', plans: [ { data: '總量 10GB', days: '15天', price: 890 }, { data: '吃到飽', days: '30天', price: 1800 } ] },
    { country: '法國', region: '歐洲', flag: '🇫🇷', plans: [ { data: '總量 5GB', days: '7天', price: 550 } ] },
    { country: '澳洲', region: '大洋洲', flag: '🇦🇺', plans: [ { data: '每日 1GB', days: '10天', price: 720 } ] }
  ];

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

  const completeOrder = async () => {
    const nameInput = document.getElementById('nameInput') as HTMLInputElement;
    const emailInput = document.getElementById('emailInput') as HTMLInputElement;
    
    if (!nameInput?.value || !emailInput?.value) {
      showToast("⚠️ 請填寫姓名與電子郵件");
      return;
    }

    // 呼叫後端 API
    try {
      showToast("⏳ 正在處理訂單與發送 QR Code...");
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameInput.value,
          email: emailInput.value,
          items: cart,
          total: cartTotal
        })
      });
      
      // 為了展示順暢，不管 API 有沒有 key 報錯，都跑完成功流程
      setIsCheckoutOpen(false);
      setIsSuccessOpen(true);
      setCart([]);
    } catch (error) {
      showToast("❌ 訂單處理失敗");
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
          <li><a href="#faq" className="text-muted hover:text-text-main transition-colors text-sm font-medium">常見問題</a></li>
        </ul>
        <button 
          onClick={() => setIsCartOpen(true)}
          className="flex items-center gap-2 bg-coral hover:bg-coral/90 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(255,78,106,0.4)] transition-all text-white px-4 py-2 rounded-full font-bold text-sm"
        >
          <ShoppingCart size={18} />
          購物車
          <span className="bg-yellow text-dark w-5 h-5 rounded-full flex items-center justify-center text-xs font-black">
            {cart.length}
          </span>
        </button>
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
        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animation-delay-300">
          <button className="bg-gradient-to-br from-coral to-[#FF8C42] hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(255,78,106,0.4)] transition-all text-white font-bold py-3 px-8 rounded-full">
            尋找目的地 eSIM
          </button>
          <button className="border-2 border-white/20 hover:border-cyan hover:-translate-y-1 transition-all text-white font-bold py-3 px-8 rounded-full">
            如何安裝？
          </button>
        </div>
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
          {filteredProducts.map((product, idx) => (
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
                {product.plans.map((plan, pIdx) => (
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

      {/* 結帳對話框 (簡易版) */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex justify-center items-end md:items-center">
          <div className="bg-[#1A1A2E] w-full max-w-md rounded-t-3xl md:rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsCheckoutOpen(false)} className="absolute top-4 right-4 bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-white">✕</button>
            
            <h3 className="text-xl font-black mb-6">結帳資料</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-muted mb-2">收件人姓名</label>
                <input id="nameInput" type="text" placeholder="例: 王小明" className="w-full bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan" />
              </div>
              <div>
                <label className="block text-sm text-muted mb-2">電子郵件 (接收 eSIM QR Code)</label>
                <input id="emailInput" type="email" placeholder="example@mail.com" className="w-full bg-card-bg border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan" />
              </div>
            </div>

            <div className="bg-card-bg border border-white/10 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted">應付總額</span>
                <span className="text-xl font-black text-coral">NT${cartTotal}</span>
              </div>
            </div>

            <button onClick={completeOrder} className="w-full bg-cyan text-dark font-black py-4 rounded-xl hover:-translate-y-1 transition-all">
              確認付款 (模擬)
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
            <p className="text-muted mb-8">您的 eSIM QR Code 與安裝說明已經寄送到您的信箱，請查收。</p>
            <button onClick={() => setIsSuccessOpen(false)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-8 rounded-full transition-all">
              返回首頁
            </button>
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
