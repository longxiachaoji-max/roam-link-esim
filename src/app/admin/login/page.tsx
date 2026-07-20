"use client";

import { FormEvent, useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { adminFetch } from '@/lib/admin-fetch';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('j800825j@gmail.com');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setMessage('Email 或密碼錯誤');
      setIsSubmitting(false);
      return;
    }
    const response = await adminFetch('/api/admin/session', { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      await supabase.auth.signOut();
      setMessage(result.error || '此帳號沒有後台管理權限');
      setIsSubmitting(false);
      return;
    }
    router.replace('/admin');
  };

  const sendResetEmail = async () => {
    if (!email.trim()) {
      setMessage('請先輸入管理員 Email');
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin/login`
    });
    setMessage(error ? error.message : '密碼重設信已寄出');
    setIsSubmitting(false);
  };

  const updatePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 12) {
      setMessage('新密碼至少需要 12 碼');
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setMessage(error ? error.message : '密碼已更新，正在進入後台');
    setIsSubmitting(false);
    if (!error) router.replace('/admin');
  };

  return (
    <main className="min-h-screen bg-[#0B0B1A] text-white grid place-items-center px-5 py-10">
      <section className="w-full max-w-md border border-white/10 bg-[#151529] p-7 md:p-9 rounded-lg shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 grid place-items-center bg-cyan text-[#0B0B1A] rounded-md">
            <KeyRound size={23} />
          </div>
          <div>
            <h1 className="text-2xl font-black">管理後台</h1>
            <p className="text-sm text-gray-400">FirstRoamLink</p>
          </div>
        </div>

        {isRecovery ? (
          <form onSubmit={updatePassword} className="space-y-5">
            <label className="block">
              <span className="block text-sm text-gray-300 mb-2">設定新密碼</span>
              <input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={12} required className="w-full bg-[#0B0B1A] border border-white/15 rounded-md px-4 py-3 outline-none focus:border-cyan" />
            </label>
            <button disabled={isSubmitting} className="w-full bg-cyan text-[#0B0B1A] rounded-md py-3 font-black disabled:opacity-50">更新密碼</button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-5">
            <label className="block">
              <span className="block text-sm text-gray-300 mb-2">Email</span>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 text-gray-500" size={19} />
                <input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required className="w-full bg-[#0B0B1A] border border-white/15 rounded-md pl-11 pr-4 py-3 outline-none focus:border-cyan" />
              </div>
            </label>
            <label className="block">
              <span className="block text-sm text-gray-300 mb-2">密碼</span>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required className="w-full bg-[#0B0B1A] border border-white/15 rounded-md px-4 pr-12 py-3 outline-none focus:border-cyan" />
                <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '隱藏密碼' : '顯示密碼'} className="absolute right-3 top-3 text-gray-400 hover:text-white">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </label>
            <button disabled={isSubmitting} className="w-full bg-cyan text-[#0B0B1A] rounded-md py-3 font-black disabled:opacity-50">{isSubmitting ? '登入中...' : '登入'}</button>
            <button type="button" onClick={sendResetEmail} disabled={isSubmitting} className="w-full text-sm text-gray-400 hover:text-white">忘記密碼</button>
          </form>
        )}
        {message && <p role="status" className="mt-5 text-sm text-center text-yellow">{message}</p>}
      </section>
    </main>
  );
}
