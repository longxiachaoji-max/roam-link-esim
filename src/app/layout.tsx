import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "一飛通全球漫遊 Roam Link | eSIM 全球通",
  description: "隨時隨地保持連線。購買一飛通全球漫遊 eSIM，體驗最順暢的跨國網路。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={spaceGrotesk.variable}>
      <body className="font-sans bg-[#0D0D1A] text-[#F0F0FF] overflow-x-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
