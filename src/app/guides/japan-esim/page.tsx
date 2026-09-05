import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
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
import EsimPageHeader from '@/app/esim/esim-page-header';
import { serializeJsonLd } from '@/lib/json-ld';

const canonicalUrl = 'https://firstesim.space/guides/japan-esim';
const reviewedDate = '2026-09-05';
const pageTitle = '日本 eSIM 怎麼選？日本網卡吃到飽、每日流量與電信網路比較';
const pageDescription = '日本 eSIM 完整選購指南：依使用量選日本網卡吃到飽、每日流量或總量型，並說明 KDDI、SoftBank、使用天數、手機相容性、安裝與抵達日本後的設定。';

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  keywords: [
    '日本 eSIM 怎麼選',
    '日本 eSIM 推薦',
    '日本網卡吃到飽',
    '日本 SIM 卡吃到飽',
    '日本 eSIM 吃到飽',
    'KDDI eSIM',
    'SoftBank eSIM'
  ],
  alternates: { canonical: '/guides/japan-esim' },
  openGraph: {
    type: 'article',
    title: pageTitle,
    description: '從流量、天數、網路、手機相容性到安裝設定，一次看懂日本旅遊 eSIM。',
    url: canonicalUrl,
    siteName: '一飛通全球漫遊 FirstRoamLink'
  }
};

const faqItems = [
  {
    question: '日本 eSIM 吃到飽就一定完全不限速嗎？',
    answer: '不一定。「吃到飽」可能仍有公平使用政策、高速流量門檻、尖峰時段流量管理或熱點分享限制。購買前應以各方案頁面的流量規則、降速條件與熱點說明為準。'
  },
  {
    question: '日本 eSIM 應該在台灣安裝，還是抵達日本再安裝？',
    answer: '通常可在出發前連接穩定 Wi-Fi 完成安裝，但方案何時開始計算效期並不完全相同，可能是安裝後、啟用後或首次連上目的地網路後開始。請先閱讀該方案的啟用規則，再決定安裝時間。'
  },
  {
    question: '到日本後需要開啟數據漫遊嗎？',
    answer: '許多旅遊 eSIM 需要為該 eSIM 開啟數據漫遊才能上網，但仍應以方案安裝說明為準。建議把行動數據指定為旅遊 eSIM，並關閉原門號的數據漫遊及行動數據切換，降低原門號產生漫遊數據費用的風險。'
  },
  {
    question: 'KDDI 和 SoftBank 哪一個訊號比較好？',
    answer: '沒有適用所有地點與手機的單一答案。兩者在日本都有廣泛覆蓋，但實際連線會受所在地、室內外環境、山區或地下空間、網路壅塞、手機支援頻段，以及方案採用的連線路徑影響。請依行程查看官方涵蓋地圖。'
  },
  {
    question: '原本的台灣門號可以保留收簡訊嗎？',
    answer: '支援雙 SIM 的手機通常能同時保留原門號與旅遊 eSIM，但是否能收簡訊、接電話及相關費用仍由原電信商與門號方案決定。請關閉原門號的數據漫遊，必要時也向原電信商確認海外語音與簡訊費率。'
  },
  {
    question: 'eSIM 安裝後沒有網路，應該先做什麼？',
    answer: '先確認旅遊 eSIM 已開啟、行動數據已指定到該 eSIM、數據漫遊設定符合方案要求，並檢查是否需要填寫 APN。之後可切換飛航模式或重新啟動手機。不要把刪除 eSIM 當成第一個排除步驟，因為部分 QR Code 只能安裝一次。'
  }
];

const breadcrumbData = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://firstesim.space/' },
    { '@type': 'ListItem', position: 2, name: '日本 eSIM', item: 'https://firstesim.space/esim/japan' },
    { '@type': 'ListItem', position: 3, name: '日本 eSIM 怎麼選', item: canonicalUrl }
  ]
};

const articleData = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: pageTitle,
  description: pageDescription,
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

const planTypes = [
  {
    name: '每日流量型',
    icon: Clock3,
    suitable: '每天用量相近，想控制每一天可用額度的人',
    advantage: '每天重新取得當日額度，旅途中較容易分配',
    check: '每日重置時間、額度用完後是降速或斷網，以及未用完能否累積'
  },
  {
    name: '總量型',
    icon: Database,
    suitable: '某幾天大量使用、其餘天數較少，想彈性分配的人',
    advantage: '整段效期共用一個流量池，不受每日額度限制',
    check: '總流量用完後的處理方式、是否能加購，以及效期從何時起算'
  },
  {
    name: '吃到飽型',
    icon: Wifi,
    suitable: '長時間導航、影音、工作或多人熱點，且不想反覆估算流量的人',
    advantage: '較不必擔心總流量用完，但仍要閱讀使用規則',
    check: '高速流量門檻、公平使用政策、流量管理、熱點分享與限速條件'
  }
];

const usageLevels = [
  {
    level: '輕量使用',
    examples: 'LINE 文字訊息、查地圖、看交通與簡單網頁',
    startingPoint: '可先從每日 1GB 或合適的總量型比較'
  },
  {
    level: '一般使用',
    examples: '社群瀏覽、上傳照片、導航、查餐廳與偶爾短影音',
    startingPoint: '可先比較每日 2–3GB 或旅程總量方案'
  },
  {
    level: '重度使用',
    examples: '長時間影音、直播、遠端工作、視訊會議或分享熱點',
    startingPoint: '可比較每日 5–10GB 或吃到飽，並確認限速與熱點規則'
  }
];

const officialSources = [
  { label: 'Apple：在 iPhone 上設定 eSIM', href: 'https://support.apple.com/zh-tw/118669' },
  { label: 'Apple：出國時在 iPhone 上使用 eSIM', href: 'https://support.apple.com/zh-tw/118227' },
  { label: 'Apple：如果無法在 iPhone 上設定 eSIM', href: 'https://support.apple.com/zh-tw/102478' },
  { label: 'Apple：清除 iPhone 或 iPad 上的 eSIM', href: 'https://support.apple.com/zh-tw/102421' },
  { label: 'Google Pixel：進一步瞭解 eSIM', href: 'https://support.google.com/pixelphone/answer/16115741?hl=zh-Hant' },
  { label: 'Samsung 台灣：Galaxy eSIM 與支援的電信業者', href: 'https://www.samsung.com/tw/support/mobile-devices/galaxy-esim-and-supported-network-carriers/' },
  { label: 'au／KDDI：日本服務區域', href: 'https://www.au.com/english/mobile/area/' },
  { label: 'SoftBank：日本服務區域地圖', href: 'https://www.softbank.jp/mobile/network/area-map/' }
];

export default function JapanEsimGuidePage() {
  return <main className="min-h-screen bg-[#0D0D1A] text-[#F0F0FF]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbData) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleData) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqData) }} />

    <EsimPageHeader fallbackHref="/esim/japan" />

    <article className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-6 md:pb-24">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-white/40" aria-label="麵包屑">
        <Link href="/" className="hover:text-white">首頁</Link><span>/</span>
        <Link href="/esim/japan" className="hover:text-white">日本 eSIM</Link><span>/</span>
        <span className="text-white/65">日本 eSIM 怎麼選</span>
      </nav>

      <header className="border-b border-white/10 py-10 md:py-14">
        <p className="text-xs font-black tracking-[0.18em] text-[#56d5ea]">JAPAN eSIM GUIDE</p>
        <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight md:text-5xl">日本 eSIM 怎麼選？日本網卡吃到飽、每日流量與電信網路完整比較</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-white/65">先看每天會用多少流量，再確認旅遊天數、網路涵蓋、手機相容性與啟用規則。沒有任何一種方案適合所有人；真正適合的是能涵蓋你的行程，又把限制寫清楚的方案。</p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link href="/esim/japan" className="inline-flex h-11 items-center gap-2 rounded-md bg-[#ff5a69] px-5 text-sm font-black text-white hover:bg-[#ff7180]">查看日本 eSIM 方案與價格 <ArrowRight size={16} /></Link>
          <span className="text-xs text-white/40">最後查核：2026 年 9 月 5 日</span>
        </div>
      </header>

      <section className="py-11" aria-labelledby="quick-answer-heading">
        <div className="rounded-xl border border-[#56d5ea]/25 bg-[#56d5ea]/[0.06] p-6 md:p-8">
          <h2 id="quick-answer-heading" className="text-2xl font-bold">先看結論：用 4 個條件篩選</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ['手機能不能用', '確認手機支援 eSIM，且沒有電信商鎖定。'],
              ['需要多少流量', '依導航、社群、影音、工作與熱點分享估算。'],
              ['效期是否涵蓋行程', '同時確認起算點、每日重置時間與時區。'],
              ['限制能不能接受', '看清楚降速、公平使用、熱點與 APN 規則。']
            ].map(([title, body], index) => <li key={title} className="flex gap-3 rounded-lg border border-white/10 bg-[#141421] p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#56d5ea] text-xs font-black text-[#07141b]">{index + 1}</span>
              <div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-white/55">{body}</p></div>
            </li>)}
          </ol>
        </div>
      </section>

      <section className="border-y border-white/10 py-11" aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="text-2xl font-bold">第一步：依使用情境估算流量</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">以下是方便開始比較的選購起點，不是流量保證。影片畫質、自動備份、App 更新、視訊時間與熱點裝置數量，都可能讓實際用量大幅增加。</p>
        <div className="mt-6 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.06] text-white"><tr><th className="p-4">使用程度</th><th className="p-4">常見情境</th><th className="p-4">建議從這裡開始比較</th></tr></thead>
            <tbody className="divide-y divide-white/10 text-white/60">
              {usageLevels.map(item => <tr key={item.level}><th scope="row" className="p-4 font-bold text-[#56d5ea]">{item.level}</th><td className="p-4 leading-6">{item.examples}</td><td className="p-4 leading-6">{item.startingPoint}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100/80">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-300" size={18} />
          <p>如果會讓相簿自動備份、下載離線影片、開高畫質直播或把網路分享給筆電，請預留更多流量；也可先下載離線地圖並關閉非必要的背景更新。</p>
        </div>
      </section>

      <section className="py-11" aria-labelledby="plan-type-heading">
        <h2 id="plan-type-heading" className="text-2xl font-bold">第二步：每日流量、總量型、吃到飽怎麼選</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {planTypes.map(item => {
            const Icon = item.icon;
            return <article key={item.name} className="rounded-lg border border-white/10 bg-[#171724] p-5">
              <Icon className="text-[#56d5ea]" size={24} />
              <h3 className="mt-4 text-lg font-bold">{item.name}</h3>
              <dl className="mt-4 space-y-4 text-sm leading-6">
                <div><dt className="font-bold text-white/80">適合</dt><dd className="text-white/50">{item.suitable}</dd></div>
                <div><dt className="font-bold text-white/80">優點</dt><dd className="text-white/50">{item.advantage}</dd></div>
                <div><dt className="font-bold text-white/80">購買前確認</dt><dd className="text-white/50">{item.check}</dd></div>
              </dl>
            </article>;
          })}
        </div>
        <p className="mt-5 text-sm leading-7 text-white/55"><strong className="text-white">特別注意「吃到飽」：</strong>名稱不等於任何時間都維持最高速度。公平使用政策、高速額度、網路管理與熱點限制會因商品而異，請以該商品頁面列出的規則為準。</p>
      </section>

      <section className="border-y border-white/10 py-11" aria-labelledby="network-heading">
        <div className="grid gap-8 md:grid-cols-[1fr_280px] md:items-start">
          <div>
            <h2 id="network-heading" className="text-2xl font-bold">第三步：KDDI 與 SoftBank 不要只看品牌名稱</h2>
            <p className="mt-4 text-sm leading-7 text-white/55">KDDI（au）與 SoftBank 都在日本提供行動網路，無法只用一個品牌名稱判定所有城市、室內、山區與手機上的訊號表現。實際體驗還會受到建築物、地下空間、地形、尖峰壅塞、手機支援頻段，以及旅遊 eSIM 的連線方式影響。</p>
            <p className="mt-4 text-sm leading-7 text-white/55">選擇時先列出會停留最久或最在意訊號的地點，例如住宿、滑雪場、郊區自駕路線，再查看官方涵蓋地圖。涵蓋地圖是選擇依據之一，不代表每個位置與每個時段都能達到相同速度。</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#171724] p-5">
            <MapPin className="text-[#56d5ea]" size={23} />
            <h3 className="mt-3 font-bold">官方涵蓋地圖</h3>
            <div className="mt-4 space-y-3 text-sm">
              <a href="https://www.au.com/mobile/area/map/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 text-[#56d5ea] hover:text-white">KDDI／au 地圖 <ExternalLink size={14} /></a>
              <a href="https://www.softbank.jp/mobile/network/area-map/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 text-[#56d5ea] hover:text-white">SoftBank 地圖 <ExternalLink size={14} /></a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-11" aria-labelledby="days-heading">
        <h2 id="days-heading" className="text-2xl font-bold">第四步：天數要看「起算方式」，不能只看 5 天或 7 天</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">先用抵達日本到離開日本的時間計算需要涵蓋的期間，再逐項確認以下規則。不同供應商與方案可能採不同定義，商品頁的規則優先於一般說明。</p>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {[
            '效期從安裝、啟用，還是首次連上日本網路後開始？',
            '「1 天」是連續 24 小時，還是依特定時區的日曆日計算？',
            '每日流量在什麼時間重置？採日本時間或其他時區？',
            '是否有最晚安裝日、兌換期限或啟用期限？'
          ].map(item => <li key={item} className="flex gap-3 rounded-lg border border-white/10 p-4 text-sm leading-6 text-white/60"><CheckCircle2 className="mt-0.5 shrink-0 text-[#56d5ea]" size={17} />{item}</li>)}
        </ul>
      </section>

      <section className="border-y border-white/10 py-11" aria-labelledby="compatibility-heading">
        <h2 id="compatibility-heading" className="text-2xl font-bold">第五步：確認手機支援 eSIM，而且已解除電信商鎖定</h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/55">型號相同，也可能因銷售地區、電信商版本或韌體而有差異。最可靠的做法是直接在自己的手機設定內確認是否能新增 eSIM，並確認裝置沒有 SIM 卡限制。</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-white/10 bg-[#171724] p-5"><Smartphone className="text-[#56d5ea]" /><h3 className="mt-3 font-bold">iPhone</h3><p className="mt-2 text-sm leading-6 text-white/50">Apple 一般列出 iPhone XS、XS Max、XR 或後續機型可使用 eSIM，但中國大陸、香港、澳門等地區販售機型有例外，請以 Apple 對該機型與地區的說明為準。</p></article>
          <article className="rounded-lg border border-white/10 bg-[#171724] p-5"><Smartphone className="text-[#56d5ea]" /><h3 className="mt-3 font-bold">Google Pixel</h3><p className="mt-2 text-sm leading-6 text-white/50">Google 說明 Pixel 4 及後續機型可使用 eSIM；部分較早機型、購買地區與電信商版本有例外。雙 eSIM 能力也會因機型與電信商支援而異。</p></article>
          <article className="rounded-lg border border-white/10 bg-[#171724] p-5"><Smartphone className="text-[#56d5ea]" /><h3 className="mt-3 font-bold">Samsung Galaxy</h3><p className="mt-2 text-sm leading-6 text-white/50">Galaxy 的 eSIM 支援會依國家、電信商與型號而異。可在「設定 → 連接 → SIM 管理員」查看是否有「新增 eSIM」。</p></article>
        </div>
        <p className="mt-5 flex gap-3 text-sm leading-7 text-white/55"><ShieldCheck className="mt-1 shrink-0 text-[#56d5ea]" size={18} /><span><strong className="text-white">解除鎖定也很重要：</strong>手機支援 eSIM，不代表一定能加入其他電信商的方案。iPhone 可在「設定 → 一般 → 關於本機」查看電信業者鎖定狀態；其他品牌請向原電信商或依裝置說明確認。</span></p>
      </section>

      <section className="py-11" aria-labelledby="install-heading">
        <h2 id="install-heading" className="text-2xl font-bold">出發前安裝與抵達日本後設定</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <article className="rounded-lg border border-white/10 p-5">
            <h3 className="flex items-center gap-2 font-bold"><Wifi className="text-[#56d5ea]" size={20} />出發前</h3>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-white/55">
              <li>1. 在穩定 Wi-Fi 下，依方案說明決定是否先安裝。</li>
              <li>2. QR Code 可放在另一台裝置顯示；若供應商提供連結或手動資料，也可依指示新增。</li>
              <li>3. 把新方案命名為「日本 eSIM」，保留訂單與安裝資訊。</li>
              <li>4. 安裝後不要隨意刪除；部分 QR Code 只能使用一次。</li>
              <li>5. 尚未抵達日本前，是否關閉該 eSIM 及數據漫遊，依方案說明操作。</li>
            </ol>
          </article>
          <article className="rounded-lg border border-white/10 p-5">
            <h3 className="flex items-center gap-2 font-bold"><Signal className="text-[#56d5ea]" size={20} />抵達日本後</h3>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-white/55">
              <li>1. 開啟日本 eSIM，將「行動數據」指定為日本 eSIM。</li>
              <li>2. 依方案要求開啟該 eSIM 的數據漫遊。</li>
              <li>3. 關閉原門號的數據漫遊及「允許行動數據切換」。</li>
              <li>4. 如方案提供 APN，請逐字輸入；沒有要求就不要自行猜測。</li>
              <li>5. 等待數分鐘；仍未連線可切換飛航模式或重新啟動。</li>
            </ol>
          </article>
        </div>
        <p className="mt-5 text-sm leading-7 text-white/45">保留原門號接收簡訊或電話是否可行、是否收費，取決於原電信商與門號方案；關閉原門號的數據漫遊只能降低數據漫遊費用風險，並不代表所有海外語音與簡訊都免費。</p>
      </section>

      <section className="border-y border-white/10 py-11" aria-labelledby="troubleshooting-heading">
        <h2 id="troubleshooting-heading" className="text-2xl font-bold">沒有訊號或無法上網：照順序排除</h2>
        <div className="mt-6 grid gap-3">
          {[
            ['看得到 eSIM，但沒有網路', '確認行動數據選的是日本 eSIM、漫遊設定符合方案要求，並核對 APN。'],
            ['完全沒有訊號', '確認已抵達方案涵蓋區域、效期已開始，嘗試切換飛航模式或重新開機，並查看業者涵蓋地圖。'],
            ['QR Code 顯示無效或已使用', '不要重複刪除與安裝；整理錯誤畫面、訂單編號、手機型號與 EID／IMEI 後聯絡客服。'],
            ['手機能上網但不能分享熱點', '先查看商品是否允許熱點、是否有限額，再確認個人熱點與 APN 設定。']
          ].map(([title, body], index) => <article key={title} className="grid gap-2 rounded-lg border border-white/10 p-4 sm:grid-cols-[34px_190px_1fr] sm:items-start">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs font-bold text-[#56d5ea]">{index + 1}</span><h3 className="font-bold">{title}</h3><p className="text-sm leading-6 text-white/55">{body}</p>
          </article>)}
        </div>
        <div className="mt-5 flex gap-3 rounded-lg border border-red-300/20 bg-red-300/[0.05] p-4 text-sm leading-6 text-red-100/75"><AlertTriangle className="mt-0.5 shrink-0 text-red-300" size={18} /><p>不要把「刪除 eSIM」當作第一個排除步驟。Apple 也建議除非電信業者指示，否則不要為了疑難排解而清除 eSIM；刪除後可能需要重新取得方案。</p></div>
      </section>

      <section className="py-11" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-2xl font-bold">日本 eSIM 常見問題</h2>
        <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
          {faqItems.map(item => <details key={item.question} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold marker:content-none"><span>{item.question}</span><span aria-hidden="true" className="text-xl text-[#56d5ea] transition-transform group-open:rotate-45">+</span></summary>
            <p className="mt-3 max-w-4xl pr-8 text-sm leading-7 text-white/55">{item.answer}</p>
          </details>)}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#171724] p-6 md:p-8" aria-labelledby="source-heading">
        <h2 id="source-heading" className="text-lg font-bold">資料來源與內容原則</h2>
        <p className="mt-3 text-sm leading-7 text-white/50">裝置與網路資訊依下列官方資料交叉查核，最後查核日為 2026 年 9 月 5 日。手機系統、支援型號與網路涵蓋可能更新；實際商品的流量、效期、啟用、APN、熱點與退費規則，請以購買當下的商品頁與訂單說明為準。</p>
        <ul className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          {officialSources.map(source => <li key={source.href}><a href={source.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 text-[#56d5ea] hover:text-white"><ExternalLink className="mt-1 shrink-0" size={13} /><span>{source.label}</span></a></li>)}
        </ul>
      </section>

      <section className="mt-11 border-y border-[#56d5ea]/20 bg-[#56d5ea]/[0.05] px-5 py-8 text-center md:px-8">
        <h2 className="text-2xl font-black">已經知道自己的用量與天數？</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/55">前往日本方案頁比較目前上架的每日流量、總量型與吃到飽方案。購買前再核對商品頁的啟用、限速與熱點規則。</p>
        <Link href="/esim/japan" className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-[#ff5a69] px-5 text-sm font-black text-white hover:bg-[#ff7180]">比較日本 eSIM 方案 <ArrowRight size={16} /></Link>
      </section>
    </article>
  </main>;
}
