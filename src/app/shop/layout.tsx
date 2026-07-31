import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '一飛通商城｜手機、空拍機與旅遊設備租借',
  description: '一飛通全球漫遊商城目前提供 S26 Ultra 手機、DJI Neo 空拍機、飛行電池與遙控器租借，可查看租期、價格與配送方式。',
  alternates: { canonical: '/shop' },
  keywords: ['手機租借', '旅遊手機租借', '演唱會手機租借', 'S26 Ultra 租借', '空拍機租借', 'DJI Neo 租借', '空拍機電池租借', 'DJI 遙控器租借'],
  openGraph: {
    title: '一飛通商城｜手機、空拍機與旅遊設備租借',
    description: 'S26 Ultra 手機、DJI Neo 空拍機、飛行電池與遙控器租借。',
    url: 'https://firstesim.space/shop'
  }
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
