import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, ExternalLink, MapPin, ShieldCheck } from 'lucide-react';
import EsimPageHeader from '@/app/esim/esim-page-header';
import { ESIM_GUIDES, OUTBOUND_RANKING_SOURCE, RANKED_ESIM_GUIDES } from '@/lib/esim-guides';
import { serializeJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: '出國 eSIM 怎麼選？台灣旅客熱門目的地完整指南',
  description: '依台灣旅客出國統計整理日本、中國、韓國、香港、越南、泰國、印尼與中港澳 eSIM 選購指南，逐項比較流量、吃到飽、合作網路、手機相容、啟用與當地限制。',
  keywords: ['出國 eSIM 怎麼選', '旅遊 eSIM 推薦', '出國網卡', 'eSIM 吃到飽', '台灣人出國排名'],
  alternates: { canonical: '/guides' },
  openGraph: {
    type: 'website',
    title: '出國 eSIM 怎麼選？台灣旅客熱門目的地完整指南',
    description: '依官方完整年度資料排定補強順序，查看各目的地的流量、網路、啟用及限制。',
    url: 'https://firstesim.space/guides',
    siteName: '一飛通全球漫遊 FirstRoamLink'
  }
};

const guideDescriptions: Record<string, string> = {
  japan: '比較日本網卡吃到飽、每日流量、總量型、KDDI／SoftBank 涵蓋與手機設定。',
  china: '確認大陸旅遊網卡的漫遊路由、常用服務、數據功能、流量與裝置來源限制。',
  korea: '依首爾、釜山、濟州島行程比較流量、SKT／KT／LG U+、熱點與門號需求。',
  'hong-kong': '分清本地預付服務與境外旅遊 eSIM，確認實名、跨境、流量與手機型號。',
  vietnam: '依河內、峴港、胡志明市、富國島與跨城市路線確認流量及合作網路。',
  thailand: '依曼谷、清邁、普吉島與離島行程比較 AIS、True／dtac、KYC 與熱點。',
  indonesia: '依峇里島、雅加達及跨島行程檢查涵蓋、5G 條件、流量與離線準備。'
};

export default function EsimGuidesPage() {
  const crossRegionGuide = ESIM_GUIDES.find(guide => guide.slug === 'greater-china-esim');
  const itemListData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '台灣旅客熱門出國目的地 eSIM 指南',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: RANKED_ESIM_GUIDES.length,
    itemListElement: RANKED_ESIM_GUIDES.map(guide => ({
      '@type': 'ListItem',
      position: guide.priorityRank,
      name: `${guide.name} eSIM 怎麼選`,
      url: `https://firstesim.space/guides/${guide.slug}`
    }))
  };
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://firstesim.space/' },
      { '@type': 'ListItem', position: 2, name: '出國 eSIM 指南', item: 'https://firstesim.space/guides' }
    ]
  };

  return <main className="min-h-screen bg-[#0D0D1A] text-[#F0F0FF]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListData) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbData) }} />
    <EsimPageHeader fallbackHref="/" />

    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-6 md:pb-24">
      <nav className="flex items-center gap-2 text-xs text-white/40" aria-label="麵包屑">
        <Link href="/" className="hover:text-white">首頁</Link><span>/</span><span className="text-white/65">出國 eSIM 指南</span>
      </nav>

      <header className="border-b border-white/10 py-10 md:py-14">
        <p className="text-xs font-black tracking-[0.18em] text-[#56d5ea]">TRAVEL eSIM GUIDE</p>
        <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight md:text-5xl">依台灣旅客熱門出國目的地，選對 eSIM</h1>
        <p className="mt-5 max-w-4xl text-base leading-8 text-white/65">先估算每天會用多少流量，再核對完整行程、合作網路、手機相容性、效期起算、熱點與當地限制。以下依交通部觀光署 2025 完整年度資料，排列本站目前已有方案的目的地補強順序。</p>
      </header>

      <section className="grid gap-4 border-b border-white/10 py-9 md:grid-cols-3" aria-label="閱讀原則">
        <article className="rounded-lg border border-white/10 bg-[#171724] p-5"><BarChart3 className="text-[#56d5ea]" size={22} /><h2 className="mt-3 font-bold">排名如何計算</h2><p className="mt-2 text-sm leading-6 text-white/50">以 2025 年「首站抵達地」人次排序，只比較本站目前支援的出國目的地。</p></article>
        <article className="rounded-lg border border-white/10 bg-[#171724] p-5"><MapPin className="text-[#56d5ea]" size={22} /><h2 className="mt-3 font-bold">不是全國總榜</h2><p className="mt-2 text-sm leading-6 text-white/50">未上架目的地沒有列入；首站統計也不等同旅客最終停留國家的實際入境人次。</p></article>
        <article className="rounded-lg border border-white/10 bg-[#171724] p-5"><ShieldCheck className="text-[#56d5ea]" size={22} /><h2 className="mt-3 font-bold">內容查核原則</h2><p className="mt-2 text-sm leading-6 text-white/50">不把吃到飽寫成永不限速，也不預設含門號、語音、簡訊或所有常用服務。</p></article>
      </section>

      <section className="py-11" aria-labelledby="ranked-guides-heading">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold text-[#56d5ea]">2025 完整年度資料</p><h2 id="ranked-guides-heading" className="mt-2 text-2xl font-bold">目的地補強優先順序</h2></div>
          <a href={OUTBOUND_RANKING_SOURCE.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-white/45 hover:text-[#56d5ea]">查看交通部觀光署原始資料 <ExternalLink size={13} /></a>
        </div>
        <ol className="mt-7 grid gap-4 md:grid-cols-2">
          {RANKED_ESIM_GUIDES.map(guide => <li key={guide.slug} className="group rounded-xl border border-white/10 bg-[#151522] p-5 transition-colors hover:border-[#56d5ea]/40 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#56d5ea] text-sm font-black text-[#07141b]">{guide.priorityRank}</span><span className="text-3xl" aria-hidden="true">{guide.flag}</span><h3 className="text-xl font-black">{guide.name} eSIM</h3></div>
              <span className="shrink-0 text-right text-xs text-white/35"><strong className="block text-base text-white/65">{guide.outboundCount?.toLocaleString('zh-TW')}</strong>人次</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-white/55">{guideDescriptions[guide.destinationSlug]}</p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3">
              <Link href={`/guides/${guide.slug}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#56d5ea] group-hover:text-white">閱讀完整選購指南 <ArrowRight size={14} /></Link>
              <Link href={`/esim/${guide.destinationSlug}`} className="text-sm text-white/40 hover:text-white">查看方案與價格</Link>
            </div>
          </li>)}
        </ol>
      </section>

      {crossRegionGuide && <section className="border-y border-white/10 py-11" aria-labelledby="cross-region-heading">
        <div className="rounded-xl border border-[#56d5ea]/25 bg-[#56d5ea]/[0.06] p-6 md:flex md:items-center md:justify-between md:gap-8 md:p-8">
          <div><p className="text-xs font-bold text-[#56d5ea]">跨區行程另外比較</p><h2 id="cross-region-heading" className="mt-2 text-2xl font-bold">中國、香港、澳門同一趟怎麼選？</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">中港澳不是單一國家排名項目。跨境方案要另外確認三地涵蓋、共用流量、漫遊路由、實名及跨境後的重新連線設定。</p></div>
          <Link href="/guides/greater-china-esim" className="mt-5 inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-[#ff5a69] px-5 text-sm font-black text-white hover:bg-[#ff7180] md:mt-0">閱讀中港澳指南 <ArrowRight size={15} /></Link>
        </div>
      </section>}

      <section className="py-11" aria-labelledby="how-to-heading">
        <h2 id="how-to-heading" className="text-2xl font-bold">每一篇都會詳細回答什麼？</h2>
        <div className="mt-6 grid gap-3 text-sm leading-6 text-white/55 sm:grid-cols-2 lg:grid-cols-3">
          {['輕量、一般、重度使用的流量比較起點', '每日流量、總量型與吃到飽的限制', '主要城市、離島、山區與跨境行程', '合作網路、5G 條件與涵蓋判讀', 'iPhone、Pixel、Galaxy 相容性', '安裝、效期、數據漫遊與 APN 設定', '門號、語音、簡訊、KYC 與熱點', '無法上網時的安全排查順序', '官方資料來源與最後查核日期'].map(item => <p key={item} className="rounded-lg border border-white/10 p-4">{item}</p>)}
        </div>
      </section>
    </div>
  </main>;
}
