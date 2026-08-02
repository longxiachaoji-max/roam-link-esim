import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '一飛通商城｜手機、空拍機與旅遊設備租借',
  description: '一飛通全球漫遊商城提供旅遊手機、空拍機與攝影配件租借，可查看租期、價格、可預約日期與配送方式。',
  alternates: { canonical: '/shop' },
  keywords: ['手機租借', '旅遊手機租借', '演唱會手機租借', '空拍機租借', '攝影設備租借', '空拍機配件租借', '旅遊用品租借'],
  openGraph: {
    title: '一飛通商城｜手機、空拍機與旅遊設備租借',
    description: '旅遊手機、空拍機與攝影配件租借，查看價格與可預約日期。',
    url: 'https://firstesim.space/shop'
  }
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
