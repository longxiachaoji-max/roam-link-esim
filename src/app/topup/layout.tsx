import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '拾機 Catch the Moment | 會員儲值',
  description: '拾機會員信用卡儲值付款。',
  robots: {
    index: false,
    follow: false
  }
};

export default function TopupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
