import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '實體漫遊卡與旅行用品｜一飛通旅行選物',
  description: '一飛通全球漫遊實體商城，提供實體漫遊卡、旅行用品與商品租借服務。',
  alternates: { canonical: '/shop' },
  keywords: ['實體漫遊卡', '旅遊網卡', '旅行用品', '旅行用品租借', '出國網卡'],
  openGraph: {
    title: '一飛通旅行選物｜實體漫遊卡與旅行用品',
    description: '實體漫遊卡、旅行用品與商品租借服務。',
    url: 'https://firstesim.space/shop'
  }
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
