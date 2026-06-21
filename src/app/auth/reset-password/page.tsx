"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [returnHref, setReturnHref] = useState('/');
  const [returnLabel, setReturnLabel] = useState('返回首頁');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('returnTo') === 'topup') {
      setReturnHref('https://pay.firstesim.space');
      setReturnLabel('返回拾機儲值');
    }
    // Supabase 會自動從 URL hash 中讀取 token 並建立 session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsReady(true);
      }
    });

    // 也檢查是否已經有 session（有些情況 event 已經 fire 過了）
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsReady(true);
      }
    };
    checkSession();

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setMessage("兩次密碼輸入不一致");
      return;
    }

    if (password.length < 6) {
      setMessage("密碼至少需要 6 個字元");
      return;
    }

    setIsLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage("重設失敗：" + error.message);
    } else {
      setIsSuccess(true);
      setMessage("密碼已成功更新！");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center px-4">
      <div className="bg-[#1A1A2E] w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-white/10">
        <h1 className="text-2xl font-black text-white text-center mb-2">重設密碼</h1>
        
        {isSuccess ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 mt-6">✓</div>
            <p className="text-green-400 font-bold mb-6">{message}</p>
            <a 
              href={returnHref}
              className="inline-block bg-gradient-to-r from-[#FF4E6A] to-[#f5bd61] text-[#0a0a0c] font-black py-3 px-8 rounded-full hover:-translate-y-1 transition-all"
            >
              {returnLabel}
            </a>
          </div>
        ) : !isReady ? (
          <div className="text-center py-8">
            <p className="text-white/50 mb-4">正在驗證重設連結...</p>
            <p className="text-white/30 text-sm">如果長時間沒有反應，請重新申請重設密碼。</p>
            <a href="/" className="text-cyan-400 text-sm hover:underline mt-4 inline-block">返回首頁</a>
          </div>
        ) : (
          <>
            <p className="text-white/50 text-sm text-center mb-6">請輸入您的新密碼</p>
            
            {message && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl mb-4 text-center">
                {message}
              </div>
            )}

            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">新密碼</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="至少 6 個字元"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#00d4ff]"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">確認新密碼</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="再次輸入新密碼"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#00d4ff]"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full font-black py-3 rounded-xl transition-all ${
                  isLoading 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-[#FF4E6A] to-[#f5bd61] text-[#0a0a0c] hover:-translate-y-1'
                }`}
              >
                {isLoading ? '處理中...' : '確認重設密碼'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
