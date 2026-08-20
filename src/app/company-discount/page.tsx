import type { Metadata } from 'next';
import CompanyDiscountSearch from './company-discount-search';

export const metadata: Metadata = {
  title: '企業優惠查詢｜一飛通全球漫遊 FirstRoamLink',
  description: '輸入合作企業名稱，查詢一飛通全球漫遊企業專屬優惠代碼。',
  alternates: { canonical: '/company-discount' },
  robots: { index: true, follow: true }
};

export default function CompanyDiscountPage() {
  return <CompanyDiscountSearch />;
}
