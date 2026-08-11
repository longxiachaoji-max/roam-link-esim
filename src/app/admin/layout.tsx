"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LockKeyhole, Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authState, setAuthState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [authMessage, setAuthMessage] = useState('正在驗證管理員登入狀態');
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === '/admin/login') return;
    let active = true;
    adminFetch('/api/admin/session', { cache: 'no-store' })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.ok) {
          setAuthState('allowed');
          return;
        }
        setAuthMessage(result.error || '請先登入管理員帳號');
        setAuthState('denied');
        router.replace('/admin/login');
      })
      .catch(() => {
        if (!active) return;
        setAuthMessage('無法驗證管理員登入狀態，請稍後再試');
        setAuthState('denied');
      });
    return () => { active = false; };
  }, [pathname, router]);

  const navigation = [
    { name: '儀表板', href: '/admin' },
    { name: '會員管理', href: '/admin/customers' },
    { name: '儲值紀錄', href: '/admin/topup-history' },
    { name: '超商付款訂單', href: '/admin/barcode-orders' },
    { name: '流量統計', href: '/admin/analytics' },
    { name: '資源監控', href: '/admin/resource-monitor' },
    { name: '訂單管理', href: '/admin/orders' },
    { name: '商品評論', href: '/admin/reviews' },
    { name: '商品管理', href: '/admin/products' },
    { name: '實體商品管理', href: '/admin/physical-products' },
    { name: '實體商品訂單', href: '/admin/physical-orders' },
    { name: 'MicroEsim 方案庫', href: '/admin/microesim-plans' },
    { name: 'eSIM 庫存', href: '/admin/esim-inventory' },
    { name: '優惠代碼', href: '/admin/promo-codes' },
    { name: '付款限制', href: '/admin/payment-limits' },
    { name: '訂單提醒設定', href: '/admin/notifications' },
    { name: '聯絡資訊設定', href: '/admin/contact' },
    { name: '後台人員', href: '/admin/admin-users' },
    { name: '前台設定', href: '/admin/settings' },
  ];

  if (pathname === '/admin/login') return <>{children}</>;

  if (authState !== 'allowed') {
    return (
      <main className="min-h-screen bg-[#0B0B1A] text-white grid place-items-center px-6">
        <div className="w-full max-w-sm text-center">
          <LockKeyhole className="mx-auto mb-5 text-cyan" size={42} />
          <h1 className="text-xl font-bold mb-2">管理後台登入保護</h1>
          <p className="text-gray-400 mb-6">
            {authState === 'checking' ? '正在驗證管理員登入狀態' : authMessage}
          </p>
          {authState === 'denied' && (
            <Link href="/" className="inline-flex px-5 py-2.5 bg-cyan text-[#0B0B1A] font-bold rounded-md">
              返回首頁登入
            </Link>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-screen bg-[#0B0B1A] text-white overflow-hidden font-sans">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between bg-[#1A1A2E] border-b border-white/10 px-4 h-16 absolute top-0 w-full z-20">
        <h1 className="text-xl font-bold text-white">管理後台</h1>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-white/10 focus:outline-none"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 bg-[#1A1A2E] border-r border-white/10 w-64 transform transition-transform duration-300 ease-in-out z-30 md:relative md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
            <h1 className="text-xl font-bold text-white hidden md:block">管理後台</h1>
            <h1 className="text-xl font-bold text-white md:hidden">選單</h1>
            <button className="md:hidden p-1 text-gray-400" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center px-3 py-3 md:py-2 text-sm font-medium rounded-xl transition-colors ${
                        isActive 
                          ? 'bg-cyan/20 text-cyan font-bold' 
                          : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full pt-16 md:pt-0">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
