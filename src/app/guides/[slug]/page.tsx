import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Signal,
  Smartphone,
  Wifi
} from 'lucide-react';
import { notFound } from 'next/navigation';
import EsimPageHeader from '@/app/esim/esim-page-header';
import {
  COMMON_DEVICE_SOURCES,
  ESIM_GUIDES,
  getEsimGuide,
  OUTBOUND_RANKING_SOURCE,
  RANKED_ESIM_GUIDES
} from '@/lib/esim-guides';
import { serializeJsonLd } from '@/lib/json-ld';

const reviewedDate = '2026-09-09';

export const dynamicParams = false;

export function generateStaticParams() {
  return ESIM_GUIDES.map(guide => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = getEsimGuide((await params).slug);
  if (!guide) return { title: '找不到 eSIM 指南' };
  const canonicalUrl = `https://firstesim.space/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      type: 'article',
      title: guide.title,
      description: guide.description,
      url: canonicalUrl,
      siteName: '一飛通全球漫遊 FirstRoamLink'
    }
  };
}

const planTypes = [
  {
    name: '每日流量型',
    icon: Clock3,
    suitable: '每天使用量接近，想把每天額度分開管理',
    check: '每日何時重置、未用完能否累積、用完後降速或斷網'
  },
  {
    name: '總量型',
    icon: Database,
    suitable: '旅途中有幾天大量使用，想自行分配整段流量',
    check: '總量用完後能否加購、效期起算方式及剩餘流量查詢'
  },
  {
    name: '吃到飽型',
    icon: Wifi,
    suitable: '影音、工作或熱點需求高，不想反覆估算總量',
    check: '高速流量門檻、公平使用政策、流量管理與熱點限制'
  }
];

function buildFaqItems(guide: NonNullable<ReturnType<typeof getEsimGuide>>) {
  return [
    {
      question: `${guide.name} eSIM 吃到飽就一定完全不限速嗎？`,
      answer: '不一定。吃到飽方案仍可能有高速流量門檻、公平使用政策、尖峰流量管理或熱點分享限制，應以每個商品頁的降速與使用規則為準。'
    },
    {
      question: `${guide.name} eSIM 應該在台灣安裝嗎？`,
      answer: '通常可在出發前使用穩定 Wi-Fi 安裝，但方案可能從安裝、啟用或首次連上目的地網路後開始計算。請先閱讀商品的效期起算規則，再決定安裝時間。'
    },
    {
      question: `抵達${guide.name}後需要開啟數據漫遊嗎？`,
      answer: '許多旅遊 eSIM 需要為旅遊線路開啟數據漫遊，但仍應以商品安裝說明為準。建議將行動數據指定為旅遊 eSIM，並關閉原門號的數據漫遊及行動數據切換。'
    },
    ...guide.faqs
  ];
}

export default async function DestinationEsimGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getEsimGuide((await params).slug);
  if (!guide) notFound();

  const canonicalUrl = `https://firstesim.space/guides/${guide.slug}`;
  const destinationUrl = `https://firstesim.space/esim/${guide.destinationSlug}`;
  const faqItems = buildFaqItems(guide);
  const sources = Array.from(new Map([
    ...guide.sources,
    ...COMMON_DEVICE_SOURCES,
    ...(guide.priorityRank ? [OUTBOUND_RANKING_SOURCE] : [])
  ].map(source => [source.href, source])).values());
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://firstesim.space/' },
      { '@type': 'ListItem', position: 2, name: '出國 eSIM 指南', item: 'https://firstesim.space/guides' },
      { '@type': 'ListItem', position: 3, name: `${guide.name} eSIM`, item: destinationUrl },
      { '@type': 'ListItem', position: 4, name: `${guide.name} eSIM 怎麼選`, item: canonicalUrl }
    ]
  };
  const articleData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    datePublished: reviewedDate,
    dateModified: reviewedDate,
    inLanguage: 'zh-TW',
    mainEntityOfPage: canonicalUrl,
    author: { '@type': 'Organization', name: '一飛通全球漫遊 FirstRoamLink' },
    publisher: { '@type': 'Organization', name: '一飛通全球漫遊 FirstRoamLink', url: 'https://firstesim.space/' }
  };
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer }
    }))
  };
  const rankedIndex = RANKED_ESIM_GUIDES.findIndex(item => item.destinationSlug === guide.destinationSlug);
  const nextGuide = rankedIndex >= 0 ? RANKED_ESIM_GUIDES[rankedIndex + 1] : null;

  return <main className="min-h-screen bg-[#0D0D1A] text-[#F0F0FF]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbData) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleData) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqData) }} />

    <EsimPageHeader fallbackHref={`/esim/${guide.destinationSlug}`} />

    <article className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-6 md:pb-24">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-white/40" aria-label="麵包屑">
        <Link href="/" className="hover:text-white">首頁</Link><span>/</span>
        <Link href="/guides" className="hover:text-white">出國 eSIM 指南</Link><span>/</span>
        <span className="text-white/65">{guide.name} eSIM 怎麼選</span>
      </nav>

      <header className="border-b border-white/10 py-10 md:py-14">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-4xl" aria-hidden="true">{guide.flag}</span>
          <p className="text-xs font-black tracking-[0.18em] text-[#56d5ea]">{guide.name.toUpperCase()} eSIM GUIDE</p>
          {guide.priorityRank && <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/45">網站支援目的地優先級第 {guide.priorityRank} 名</span>}
        </div>
        <h1 className="mt-5 max-w-4xl text-3xl font-black leading-tight md:text-5xl">{guide.title}</h1>
        <p className="mt-5 max-w-4xl text-base leading-8 text-white/65">{guide.intro}</p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link href={`/esim/${guide.destinationSlug}`} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#ff5a69] px-5 text-sm font-black text-white hover:bg-[#ff7180]">查看{guide.name} eSIM 方案與價格 <ArrowRight size={16} /></Link>
          <span className="text-xs text-white/40">最後查核：2026 年 9 月 9 日</span>
        </div>
      </header>

      <section className="py-11" aria-labelledby="quick-heading">
        <div className="rounded-xl border border-[#56d5ea]/25 bg-[#56d5ea]/[0.06] p-6 md:p-8">
          <h2 id="quick-heading" className="text-2xl font-bold">先看結論：依序確認 5 件事</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ['裝置相容性', '手機必須支援 eSIM，而且沒有電信商鎖定。'],
              ['完整行程', `確認 ${guide.cities.join('、')} 等停留地與交通路線。`],
              ['每日使用量', '依導航、通訊、社群、影音、工作與熱點估算。'],
              ['商品限制', '核對高速額度、降速、熱點、APN、KYC 與語音功能。'],
              ['效期起算', '確認從安裝、啟用或首次連線開始，以及每日重置時區。']
            ].map(([title, body], index) => <li key={title} className="flex gap-3 rounded-lg border border-white/10 bg-[#141421] p-4 last:md:col-span-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#56d5ea] text-xs font-black text-[#07141b]">{index + 1}</span>
              <div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-white/55">{body}</p></div>
            </li>)}
          </ol>
        </div>
      </section>

      <section className="border-y border-white/10 py-11" aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="text-2xl font-bold">第一步：先估算流量，再選方案名稱</h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/55">這是開始比較的參考，不是用量保證。影片畫質、自動備份、App 更新、視訊時間與熱點裝置數量，會讓實際流量產生很大差異。</p>
        <div className="mt-6 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.06]"><tr><th className="p-4">程度</th><th className="p-4">{guide.name}行程情境</th><th className="p-4">比較起點</th></tr></thead>
            <tbody className="divide-y divide-white/10 text-white/60">
              <tr><th scope="row" className="p-4 font-bold text-[#56d5ea]">輕量</th><td className="p-4 leading-6">{guide.lightUse}</td><td className="p-4">每日 1GB 或適合天數的總量型</td></tr>
              <tr><th scope="row" className="p-4 font-bold text-[#56d5ea]">一般</th><td className="p-4 leading-6">{guide.normalUse}</td><td className="p-4">每日 2–3GB 或較大總量型</td></tr>
              <tr><th scope="row" className="p-4 font-bold text-[#56d5ea]">重度</th><td className="p-4 leading-6">{guide.heavyUse}</td><td className="p-4">每日 5–10GB 或吃到飽，並確認限速及熱點</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-5 flex gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100/80"><AlertTriangle className="mt-0.5 shrink-0 text-amber-300" size={18} />出發前可下載離線地圖、關閉照片與影片自動備份，並停用非必要 App 的背景更新。這些設定通常比只猜一個 GB 數更能避免旅途中突然用完。</p>
      </section>

      <section className="py-11" aria-labelledby="type-heading">
        <h2 id="type-heading" className="text-2xl font-bold">第二步：每日流量、總量型、吃到飽怎麼選</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {planTypes.map(item => {
            const Icon = item.icon;
            return <article key={item.name} className="rounded-lg border border-white/10 bg-[#171724] p-5">
              <Icon className="text-[#56d5ea]" size={24} />
              <h3 className="mt-4 text-lg font-bold">{item.name}</h3>
              <p className="mt-3 text-sm leading-6 text-white/55">{item.suitable}</p>
              <p className="mt-4 text-sm leading-6"><strong className="text-white/80">購買前確認：</strong><span className="text-white/50">{item.check}</span></p>
            </article>;
          })}
        </div>
        <p className="mt-5 text-sm leading-7 text-white/55"><strong className="text-white">「吃到飽」不等於任何時間都維持最高速度：</strong>高速流量門檻、公平使用政策、尖峰流量管理與熱點限制會因商品不同，商品頁的明確規則優先。</p>
      </section>

      <section className="border-y border-white/10 py-11" aria-labelledby="network-heading">
        <div className="grid gap-7 md:grid-cols-[1fr_280px]">
          <div>
            <h2 id="network-heading" className="text-2xl font-bold">第三步：看完整行程與合作網路</h2>
            <p className="mt-4 text-sm leading-7 text-white/55">{guide.networkAdvice}</p>
            <p className="mt-4 text-sm leading-7 text-white/45">涵蓋資訊只能用來協助選擇，不能保證每一棟建築、每一個時段與每一台手機都有相同訊號或速度。</p>
          </div>
          <aside className="rounded-lg border border-white/10 bg-[#171724] p-5">
            <MapPin className="text-[#56d5ea]" size={22} />
            <h3 className="mt-3 font-bold">常見網路標示</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/55">{guide.networks.map(network => <li key={network}>• {network}</li>)}</ul>
            <p className="mt-4 text-xs leading-5 text-white/35">實際合作網路以購買時的商品頁為準，不代表每項方案都包含上述全部網路。</p>
          </aside>
        </div>
      </section>

      <section className="py-11" aria-labelledby="special-heading">
        <h2 id="special-heading" className="text-2xl font-bold">第四步：{guide.specialHeading}</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {guide.specialChecks.map(item => <div key={item} className="flex gap-3 rounded-lg border border-white/10 p-4"><CheckCircle2 className="mt-0.5 shrink-0 text-[#56d5ea]" size={18} /><p className="text-sm leading-7 text-white/60">{item}</p></div>)}
        </div>
      </section>

      <section className="border-y border-white/10 py-11" aria-labelledby="validity-heading">
        <h2 id="validity-heading" className="text-2xl font-bold">第五步：天數與啟用時間要一起看</h2>
        <p className="mt-3 text-sm leading-7 text-white/55">把抵達日到離境日完整算入，再核對以下四項。不同供應商可能採不同定義，不能只用「5 天方案」名稱推定。</p>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {[
            '效期從安裝、啟用，還是首次連上目的地網路後開始？',
            '一天是連續 24 小時，還是依特定時區的日曆日？',
            '每日流量何時重置，採目的地時間或其他時區？',
            '是否有最晚安裝日、兌換期限或啟用期限？'
          ].map(item => <li key={item} className="flex gap-3 rounded-lg border border-white/10 p-4 text-sm leading-6 text-white/60"><CheckCircle2 className="mt-0.5 shrink-0 text-[#56d5ea]" size={17} />{item}</li>)}
        </ul>
      </section>

      <section className="py-11" aria-labelledby="device-heading">
        <h2 id="device-heading" className="text-2xl font-bold">第六步：確認手機相容性與鎖定狀態</h2>
        <p className="mt-3 text-sm leading-7 text-white/55">同一系列手機也可能因銷售地區、電信商版本或型號而不同。請直接查看手機設定是否有「加入 eSIM」，並確認裝置沒有電信商鎖定。</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-white/10 bg-[#171724] p-5"><Smartphone className="text-[#56d5ea]" /><h3 className="mt-3 font-bold">iPhone</h3><p className="mt-2 text-sm leading-6 text-white/50">一般為 iPhone XS、XS Max、XR 或後續機型，但中國大陸、香港與澳門等銷售地區有機型例外，應核對 Apple 最新說明。</p></article>
          <article className="rounded-lg border border-white/10 bg-[#171724] p-5"><Smartphone className="text-[#56d5ea]" /><h3 className="mt-3 font-bold">Google Pixel</h3><p className="mt-2 text-sm leading-6 text-white/50">Google 說明 Pixel 4 及後續機型可使用 eSIM，但較早機型、銷售地區及電信商版本可能有例外。</p></article>
          <article className="rounded-lg border border-white/10 bg-[#171724] p-5"><Smartphone className="text-[#56d5ea]" /><h3 className="mt-3 font-bold">Samsung Galaxy</h3><p className="mt-2 text-sm leading-6 text-white/50">Galaxy 支援會依國家、電信商與型號而異，可在「設定 → 連接 → SIM 管理員」查看是否有新增 eSIM。</p></article>
        </div>
        <p className="mt-5 flex gap-3 text-sm leading-7 text-white/55"><ShieldCheck className="mt-1 shrink-0 text-[#56d5ea]" size={18} /><span>支援 eSIM 不等於已解除電信商鎖定。iPhone 可在「設定 → 一般 → 關於本機」查看電信業者鎖定；其他品牌請依裝置說明或向原電信商確認。</span></p>
      </section>

      <section className="border-y border-white/10 py-11" aria-labelledby="setup-heading">
        <h2 id="setup-heading" className="text-2xl font-bold">出發前安裝與抵達後設定</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <article className="rounded-lg border border-white/10 p-5"><h3 className="flex items-center gap-2 font-bold"><Wifi className="text-[#56d5ea]" size={20} />出發前</h3><ol className="mt-4 space-y-3 text-sm leading-6 text-white/55"><li>1. 先讀啟用規則，再決定是否在穩定 Wi-Fi 下預先安裝。</li><li>2. QR Code 可放在另一台裝置顯示，並保留訂單及手動安裝資料。</li><li>3. 將新線路命名為「{guide.name} eSIM」，避免切錯。</li><li>4. 安裝後不要隨意刪除；部分 QR Code 只能安裝一次。</li><li>5. 尚未抵達前是否關閉該線路，依商品說明操作。</li></ol></article>
          <article className="rounded-lg border border-white/10 p-5"><h3 className="flex items-center gap-2 font-bold"><Signal className="text-[#56d5ea]" size={20} />抵達{guide.name}後</h3><ol className="mt-4 space-y-3 text-sm leading-6 text-white/55"><li>1. 開啟旅遊 eSIM，把行動數據指定到這張 eSIM。</li><li>2. 依商品說明開啟旅遊 eSIM 的數據漫遊。</li><li>3. 關閉原門號數據漫遊及「允許行動數據切換」。</li><li>4. 商品有提供 APN 才逐字輸入，不要自行猜測。</li><li>5. 等待數分鐘；仍未連線可切換飛航模式或重新開機。</li></ol></article>
        </div>
        <p className="mt-5 text-sm leading-7 text-white/45">保留台灣門號接收簡訊或電話是否可行、是否收費，由原電信商與門號方案決定。關閉原門號數據漫遊不代表所有海外語音與簡訊都免費。</p>
      </section>

      <section className="py-11" aria-labelledby="troubleshooting-heading">
        <h2 id="troubleshooting-heading" className="text-2xl font-bold">無法上網時照順序檢查</h2>
        <div className="mt-6 grid gap-3">
          {[
            ['線路', `確認「${guide.name} eSIM」已開啟，行動數據也選到這張 eSIM。`],
            ['漫遊與 APN', '確認數據漫遊符合商品說明；只有商品提供 APN 時才輸入指定內容。'],
            ['地點與效期', '確認已進入涵蓋地區、效期已開始，並等待手機完成搜尋合作網路。'],
            ['重新連線', '切換飛航模式或重新開機；若商品允許，也可依指示手動選擇網路。'],
            ['聯絡客服', '保留訂單編號、錯誤畫面、手機型號、EID／IMEI 及目前所在地，方便排查。']
          ].map(([title, body], index) => <article key={title} className="grid gap-2 rounded-lg border border-white/10 p-4 sm:grid-cols-[34px_130px_1fr]"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs font-bold text-[#56d5ea]">{index + 1}</span><h3 className="font-bold">{title}</h3><p className="text-sm leading-6 text-white/55">{body}</p></article>)}
        </div>
        <p className="mt-5 flex gap-3 rounded-lg border border-red-300/20 bg-red-300/[0.05] p-4 text-sm leading-6 text-red-100/75"><AlertTriangle className="mt-0.5 shrink-0 text-red-300" size={18} />不要把刪除 eSIM 當成第一個排除步驟。部分 QR Code 只能安裝一次；刪除後可能需要供應商重新提供方案。</p>
      </section>

      <section className="border-y border-white/10 py-11" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-2xl font-bold">{guide.name} eSIM 常見問題</h2>
        <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
          {faqItems.map(item => <details key={item.question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold marker:content-none"><span>{item.question}</span><span aria-hidden="true" className="text-xl text-[#56d5ea] transition-transform group-open:rotate-45">+</span></summary><p className="mt-3 max-w-4xl pr-8 text-sm leading-7 text-white/55">{item.answer}</p></details>)}
        </div>
      </section>

      <section className="mt-11 rounded-xl border border-white/10 bg-[#171724] p-6 md:p-8" aria-labelledby="source-heading">
        <h2 id="source-heading" className="text-lg font-bold">官方資料來源與內容原則</h2>
        <p className="mt-3 text-sm leading-7 text-white/50">裝置、目的地與排名資訊依官方資料查核，最後查核日為 2026 年 9 月 9 日。手機支援、網路涵蓋與法規可能更新；實際商品的流量、效期、啟用、APN、熱點、KYC 與退費規則，以購買當下商品頁及訂單說明為準。</p>
        <ul className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          {sources.map(source => <li key={source.href}><a href={source.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 text-[#56d5ea] hover:text-white"><ExternalLink className="mt-1 shrink-0" size={13} />{source.label}</a></li>)}
        </ul>
      </section>

      <section className="mt-11 border-y border-[#56d5ea]/20 bg-[#56d5ea]/[0.05] px-5 py-8 text-center md:px-8">
        <h2 className="text-2xl font-black">已經確認用量、天數與限制？</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/55">前往{guide.name}方案頁比較目前上架商品，結帳前再核對啟用、限速、熱點、KYC 與涵蓋規則。</p>
        <Link href={`/esim/${guide.destinationSlug}`} className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-[#ff5a69] px-5 text-sm font-black text-white hover:bg-[#ff7180]">比較{guide.name} eSIM 方案 <ArrowRight size={16} /></Link>
      </section>

      <nav className="mt-8 flex flex-col justify-between gap-3 border-t border-white/10 pt-7 sm:flex-row" aria-label="其他指南">
        <Link href="/guides" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"><ArrowLeft size={15} />查看全部出國 eSIM 指南</Link>
        {nextGuide && <Link href={`/guides/${nextGuide.slug}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#56d5ea] hover:text-white">下一個優先目的地：{nextGuide.name} <ArrowRight size={15} /></Link>}
      </nav>
    </article>
  </main>;
}
