import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '一飛通 eSIM 管理',
  description: '企業 eSIM 一次管理：快速安裝、批次查詢用量、購買新卡',
  manifest: '/esim-app.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: '一飛通eSIM', statusBarStyle: 'black-translucent' }
};

export const viewport: Viewport = {
  themeColor: '#12121f',
  viewportFit: 'cover'
};

export default function EsimAppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
