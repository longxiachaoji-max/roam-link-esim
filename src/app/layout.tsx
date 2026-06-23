import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://firstesim.space"),
  title: "一飛通全球漫遊 FirstRoamLink｜日本韓國全球 eSIM",
  description: "一飛通全球漫遊 FirstRoamLink 提供日本、韓國、東南亞與全球多國 eSIM 上網方案。線上購買、快速取得安裝資訊，出國落地即可連線。",
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
    "中國 eSIM",
    "美國 eSIM",
    "歐洲 eSIM",
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
    description: "日本、韓國、東南亞與全球多國 eSIM 方案，線上購買後快速取得安裝資訊。",
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
    description: "日本、韓國、東南亞與全球多國 eSIM 方案，出國落地即可連線。",
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationStructuredData) }} />
        {children}
      </body>
    </html>
  );
}
