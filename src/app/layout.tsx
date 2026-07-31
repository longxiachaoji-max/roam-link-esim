import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { serializeJsonLd } from "@/lib/json-ld";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://firstesim.space"),
  title: "一飛通全球漫遊 FirstRoamLink｜日本韓國亞洲 eSIM",
  description: "一飛通全球漫遊 FirstRoamLink 提供日本、韓國、泰國、越南、中國、中港澳與台灣 eSIM，上架每日流量、總量型、吃到飽及熱點分享方案。",
  applicationName: "一飛通全球漫遊 FirstRoamLink",
  keywords: [
    "一飛通全球漫遊",
    "FirstRoamLink",
    "eSIM",
    "日本 eSIM",
    "日本 eSIM 吃到飽",
    "KDDI eSIM",
    "韓國 eSIM",
    "泰國 eSIM",
    "越南 eSIM",
    "中國 eSIM",
    "中港澳 eSIM",
    "台灣 eSIM",
    "eSIM 吃到飽",
    "每日流量 eSIM",
    "總量型 eSIM",
    "熱點分享 eSIM",
    "出國上網",
    "全球漫遊 eSIM",
    "旅遊 eSIM",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "zh_TW",
    url: "https://firstesim.space",
    siteName: "一飛通全球漫遊 FirstRoamLink",
    title: "一飛通全球漫遊 FirstRoamLink｜全球 eSIM 上網",
    description: "日本、韓國、泰國、越南、中國、中港澳與台灣 eSIM，線上購買後快速取得安裝資訊。",
    images: [{
      url: "/icon.png",
      width: 512,
      height: 512,
      alt: "一飛通全球漫遊 FirstRoamLink",
    }],
  },
  twitter: {
    card: "summary",
    title: "一飛通全球漫遊 FirstRoamLink｜全球 eSIM 上網",
    description: "日本、韓國、泰國、越南、中國、中港澳與台灣 eSIM，出國落地即可連線。",
    images: ["/icon.png"],
  },
};

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "一飛通全球漫遊 FirstRoamLink",
  alternateName: ["FirstRoamLink", "Roam Link eSIM", "一飛通全球漫遊"],
  url: "https://firstesim.space",
  inLanguage: "zh-TW",
};

const organizationStructuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "一飛通全球漫遊 FirstRoamLink",
  url: "https://firstesim.space",
  logo: "https://firstesim.space/icon.png",
  email: "roamlinktw@gmail.com",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={spaceGrotesk.variable}>
      <body className="font-sans bg-[#0D0D1A] text-[#F0F0FF] overflow-x-hidden antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteStructuredData) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationStructuredData) }} />
        {children}
      </body>
    </html>
  );
}
