import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Globe2, ShoppingBag, Smartphone } from 'lucide-react';
import {
  createAutomaticEsimDestination,
  ESIM_DESTINATIONS,
  getEsimDestinationForCountry,
  getEsimDestinationHref
} from '@/lib/esim-destinations';
import { getActiveEsimCountries } from '@/lib/esim-seo-products';
import { serializeJsonLd } from '@/lib/json-ld';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '出國 eSIM 方案｜日本、韓國、泰國與亞洲旅遊上網',
  description: '一飛通全球漫遊 eSIM 方案總覽，依目的地比較日本、韓國、泰國、越南、中國、中港澳與台灣旅遊上網方案。',
  alternates: { canonical: '/esim' },
  openGraph: {
    title: '出國 eSIM 方案｜一飛通全球漫遊 FirstRoamLink',
    description: '依旅遊目的地、使用天數與流量需求挑選 eSIM 上網方案。',
    url: 'https://firstesim.space/esim'
  }
};

export default async function EsimDestinationHubPage() {
  const activeCountries = await getActiveEsimCountries();
  const automaticDestinations = activeCountries
    .filter(country => !getEsimDestinationForCountry(country))
    .map(country => createAutomaticEsimDestination(country))
    .filter(destination => destination !== null);
  const destinations = [...ESIM_DESTINATIONS, ...automaticDestinations];
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '出國 eSIM 方案',
    description: '日本、韓國、泰國、越南、中國、中港澳與台灣 eSIM 旅遊上網方案。',
    url: 'https://firstesim.space/esim',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: destinations.map((destination, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: destination.name,
        url: `https://firstesim.space${getEsimDestinationHref(destination)}`
      }))
    }
  };

  return <main className="min-h-screen bg-[#0D0D1A] text-[#F0F0FF]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />

    <header className="border-b border-white/10 bg-[#0D0D1A]/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="font-bold leading-tight">
          <span className="block text-xs text-white/55">一飛通全球漫遊</span>
          <span className="block text-base text-[#ff6b73]">FirstRoamLink</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-md px-3 py-2 text-white/60 hover:bg-white/5 hover:text-white">首頁</Link>
          <Link href="/shop" className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-white/60 hover:bg-white/5 hover:text-white"><ShoppingBag size={15} />商城</Link>
        </nav>
      </div>
    </header>

    <section className="border-b border-white/10 bg-[#121927] px-4 py-12 md:px-6 md:py-16">
      <div className="mx-auto max-w-6xl">
        <p className="mb-3 text-sm font-bold text-[#56d5ea]">旅遊上網方案總覽</p>
        <h1 className="max-w-3xl text-3xl font-black leading-tight md:text-5xl">依目的地選擇出國 eSIM</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-white/60 md:text-base">比較不同目的地的旅遊 eSIM、使用天數、流量與熱點分享規則。購買後可在會員中心取得安裝資訊，無需更換實體 SIM 卡。</p>
        <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/70">
          <span className="inline-flex items-center gap-2"><Smartphone size={16} className="text-[#56d5ea]" />線上取得安裝資訊</span>
          <span className="inline-flex items-center gap-2"><Globe2 size={16} className="text-[#56d5ea]" />多國旅遊上網</span>
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-[#56d5ea]" />依需求比較方案</span>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14" aria-labelledby="destination-heading">
      <h2 id="destination-heading" className="text-2xl font-bold">熱門 eSIM 目的地</h2>
      <p className="mt-2 text-sm text-white/45">選擇目的地查看目前方案與旅遊上網重點。</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map(destination => (
          <Link key={destination.slug} href={getEsimDestinationHref(destination)} className="group flex min-h-40 flex-col justify-between rounded-md border border-white/10 bg-[#181826] p-5 hover:border-[#56d5ea]/40 hover:bg-[#1d2030]">
            <div>
              <span className="text-3xl" aria-hidden="true">{destination.flag}</span>
              <h2 className="mt-4 text-lg font-bold">{destination.name}</h2>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/45">{destination.description}</p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#56d5ea]">查看方案 <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></span>
          </Link>
        ))}
      </div>
    </section>

    <section className="border-y border-white/10 bg-[#111827] px-4 py-10 md:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-xl font-bold">挑選旅遊 eSIM 的三個重點</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div><h3 className="font-bold text-[#56d5ea]">目的地與涵蓋範圍</h3><p className="mt-2 text-sm leading-6 text-white/55">單國行程選擇目的地方案；跨國或跨區行程則確認每個停留地都在涵蓋範圍內。</p></div>
          <div><h3 className="font-bold text-[#56d5ea]">天數與流量</h3><p className="mt-2 text-sm leading-6 text-white/55">將抵達日與離境日納入計算，再依地圖、社群、影音與工作需求估算流量。</p></div>
          <div><h3 className="font-bold text-[#56d5ea]">安裝與熱點</h3><p className="mt-2 text-sm leading-6 text-white/55">於啟用日前或旅程出發前使用穩定網路安裝；需要分享網路時先查看熱點額度。</p></div>
        </div>
      </div>
    </section>

    <footer className="px-4 py-9 text-sm text-white/40 md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 sm:flex-row">
        <span>一飛通全球漫遊 FirstRoamLink</span>
        <Link href="/" className="text-[#56d5ea] hover:text-white">查看全部上架方案</Link>
      </div>
    </footer>
  </main>;
}
