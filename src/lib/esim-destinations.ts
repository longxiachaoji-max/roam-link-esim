export interface EsimDestinationFaq {
  question: string;
  answer: string;
}

export interface EsimDestination {
  slug: string;
  name: string;
  shortName: string;
  flag: string;
  countries: string[];
  title: string;
  description: string;
  intro: string;
  keywords: string[];
  highlights: string[];
  faqs: EsimDestinationFaq[];
}

export const ESIM_DESTINATIONS: EsimDestination[] = [
  {
    slug: 'japan',
    name: '日本 eSIM',
    shortName: '日本',
    flag: '🇯🇵',
    countries: ['日本'],
    title: '日本 eSIM｜日本網卡、吃到飽與 KDDI 上網方案',
    description: '比較日本 eSIM 吃到飽、每日流量與總量型上網方案，依旅遊天數、熱點需求及使用量選擇，線上購買後取得安裝資訊。',
    intro: '前往東京、大阪、京都、北海道或沖繩，可依旅程天數與使用量挑選日本 eSIM。方案涵蓋吃到飽、每日流量與總量型，部分方案支援熱點分享。',
    keywords: ['日本 eSIM', '日本網卡', '日本 eSIM 吃到飽', 'KDDI eSIM', '日本上網', '日本旅遊網路'],
    highlights: ['依實際旅遊天數選擇，避免購買過多效期', '需要分享給同行裝置時，先確認熱點額度', '啟用日前或旅程出發前，在穩定網路環境完成安裝'],
    faqs: [
      { question: '日本 eSIM 要選吃到飽還是流量型？', answer: '會長時間使用地圖、社群與影音可優先比較吃到飽方案；一般查詢與通訊可依每日或總流量選擇。' },
      { question: '日本 eSIM 可以分享熱點嗎？', answer: '不同方案的熱點規則不同，可能是每日額度或總量額度，請以方案頁顯示的熱點分享說明為準。' },
      { question: '日本 eSIM 什麼時候安裝？', answer: '建議在啟用日前或旅程出發前，於穩定網路環境完成安裝，抵達後再依方案說明開啟行動數據。' }
    ]
  },
  {
    slug: 'korea',
    name: '韓國 eSIM',
    shortName: '韓國',
    flag: '🇰🇷',
    countries: ['韓國'],
    title: '韓國 eSIM｜韓國網卡與吃到飽上網方案',
    description: '比較韓國 eSIM 吃到飽、每日流量與不同旅遊天數方案，適合首爾、釜山、濟州島等韓國旅遊上網。',
    intro: '前往首爾、釜山或濟州島，可依停留天數、每日使用量與是否需要熱點分享挑選韓國 eSIM，抵達後即可使用行動網路。',
    keywords: ['韓國 eSIM', '韓國網卡', '韓國 eSIM 吃到飽', '韓國上網', '首爾 eSIM', '釜山 eSIM'],
    highlights: ['先確認方案天數是否涵蓋完整行程', '高流量或影音需求可比較吃到飽方案', '安裝前確認手機支援 eSIM 且未鎖定電信商'],
    faqs: [
      { question: '韓國 eSIM 適合哪些地區？', answer: '韓國方案適合首爾、釜山、濟州島等主要旅遊地區，實際涵蓋範圍依當地合作電信網路為準。' },
      { question: '韓國 eSIM 能否分享熱點？', answer: '熱點支援與額度依方案不同，購買前請查看方案卡片上的熱點分享說明。' },
      { question: '韓國 eSIM 需要換掉原本 SIM 卡嗎？', answer: '不需要拔除原本 SIM 卡；支援雙 SIM 的手機可保留原門號，同時使用 eSIM 上網。' }
    ]
  },
  {
    slug: 'thailand',
    name: '泰國 eSIM',
    shortName: '泰國',
    flag: '🇹🇭',
    countries: ['泰國'],
    title: '泰國 eSIM｜曼谷、清邁與泰國旅遊上網',
    description: '泰國 eSIM 方案比較，適合曼谷、清邁、普吉島等旅遊地區，提供不同天數、流量與吃到飽選擇。',
    intro: '泰國旅遊常需要使用叫車、地圖、翻譯與行動支付，可依曼谷、清邁、普吉島等行程天數選擇合適的泰國 eSIM。',
    keywords: ['泰國 eSIM', '泰國網卡', '曼谷 eSIM', '泰國上網', '泰國 eSIM 吃到飽', '清邁網卡'],
    highlights: ['依叫車、地圖與影音需求估算流量', '跨城市旅遊時確認方案使用範圍', '抵達前完成安裝，落地後依說明開啟數據漫遊'],
    faqs: [
      { question: '泰國 eSIM 可以在曼谷和清邁使用嗎？', answer: '多數泰國方案可在主要城市使用，實際訊號仍依當地基地台涵蓋與所在位置而定。' },
      { question: '去泰國幾天要買幾天方案？', answer: '建議把抵達日與離境日都算入，並確認方案採曆日制或 24 小時計算。' },
      { question: '泰國 eSIM 安裝後就開始計算嗎？', answer: '各方案啟用規則不同，請依商品說明操作；一般建議於啟用日前或出發前先完成安裝。' }
    ]
  },
  {
    slug: 'vietnam',
    name: '越南 eSIM',
    shortName: '越南',
    flag: '🇻🇳',
    countries: ['越南'],
    title: '越南 eSIM｜越南網卡與旅遊上網方案',
    description: '越南 eSIM 方案比較，適合河內、胡志明市、峴港與富國島旅遊，依天數和流量挑選行動上網方案。',
    intro: '前往河內、胡志明市、峴港或富國島，可使用越南 eSIM 處理地圖、叫車、翻譯及日常通訊，免更換實體 SIM 卡。',
    keywords: ['越南 eSIM', '越南網卡', '越南上網', '峴港 eSIM', '胡志明市網卡', '河內 eSIM'],
    highlights: ['多城市移動時預留足夠方案天數', '導航與叫車需求高，可選擇較大流量', '購買前確認手機型號支援 eSIM'],
    faqs: [
      { question: '越南 eSIM 可以跨城市使用嗎？', answer: '越南全國型方案通常可跨城市使用，實際連線品質依所在地與當地電信網路而定。' },
      { question: '越南旅遊需要多少流量？', answer: '以地圖、通訊和叫車為主可選一般流量；常看影片、直播或分享熱點則建議較大流量方案。' },
      { question: '越南 eSIM 如何安裝？', answer: '購買後依會員中心提供的安裝資訊操作，並在穩定 Wi-Fi 下完成設定。' }
    ]
  },
  {
    slug: 'china',
    name: '中國 eSIM',
    shortName: '中國',
    flag: '🇨🇳',
    countries: ['中國'],
    title: '中國 eSIM｜中國旅遊網卡與行動上網方案',
    description: '中國 eSIM 旅遊上網方案，依停留天數、流量與使用需求選擇，購買前可查看方案備註與網路使用限制。',
    intro: '前往中國旅遊或出差，可依停留天數與日常通訊、導航及工作需求挑選中國 eSIM。部分方案的網路服務與使用限制不同，購買前請確認備註。',
    keywords: ['中國 eSIM', '中國網卡', '中國上網', '中國旅遊網卡', '大陸 eSIM', '中國漫遊網路'],
    highlights: ['先確認方案是否符合常用網站與應用需求', '出差或視訊需求可選擇較大流量', '仔細閱讀方案備註與安裝限制'],
    faqs: [
      { question: '中國 eSIM 可以使用哪些網路服務？', answer: '不同漫遊路由與方案規則可能不同，請以各方案備註列出的網路服務及限制為準。' },
      { question: '中國 eSIM 能分享熱點嗎？', answer: '部分方案可分享熱點，但額度與規則不同，請在購買前查看熱點說明。' },
      { question: '中國 eSIM 適合出差使用嗎？', answer: '可依工作天數、視訊與檔案傳輸量選擇方案，重要工作建議預留足夠流量。' }
    ]
  },
  {
    slug: 'greater-china',
    name: '中港澳 eSIM',
    shortName: '中港澳',
    flag: '🌏',
    countries: ['中國 香港 澳門'],
    title: '中港澳 eSIM｜中國、香港、澳門跨區上網',
    description: '中港澳 eSIM 適合一次前往中國、香港與澳門的跨區行程，一張 eSIM 比較多地區流量與天數方案。',
    intro: '行程同時包含中國、香港與澳門時，可選擇中港澳多地區 eSIM，減少跨境後重新換卡或購買多張網卡的麻煩。',
    keywords: ['中港澳 eSIM', '香港 eSIM', '澳門 eSIM', '中港澳網卡', '香港網卡', '中國香港澳門上網'],
    highlights: ['跨境行程確認三地皆在方案涵蓋範圍', '依完整旅程而非單一城市計算天數', '切換地區後若未連線，可重新選擇網路或開關飛航模式'],
    faqs: [
      { question: '中港澳 eSIM 可以三地共用嗎？', answer: '標示為中港澳的方案涵蓋中國、香港與澳門，仍請以商品頁的實際涵蓋地區為準。' },
      { question: '只去香港也能買中港澳方案嗎？', answer: '可以，但若只停留單一地區，也可比較單國或單地區方案是否更符合流量與價格需求。' },
      { question: '跨境後需要重新安裝 eSIM 嗎？', answer: '通常不需要重新安裝；抵達新地區後裝置會搜尋可用合作網路，必要時可重新開關飛航模式。' }
    ]
  },
  {
    slug: 'taiwan',
    name: '台灣 eSIM',
    shortName: '台灣',
    flag: '🇹🇼',
    countries: ['台灣'],
    title: '台灣 eSIM｜台灣旅遊網卡與行動上網',
    description: '台灣 eSIM 旅遊上網方案，適合來台旅客依停留天數與流量需求選擇，免更換實體 SIM 卡。',
    intro: '來台旅遊、探親或短期停留，可使用台灣 eSIM 連接行動網路，依台北、台中、台南、高雄等行程天數挑選方案。',
    keywords: ['台灣 eSIM', '台灣網卡', '台灣旅遊上網', 'Taiwan eSIM', '台北 eSIM', '台灣預付網卡'],
    highlights: ['依抵台與離台日期計算完整使用天數', '常用導航與影音可選擇較大流量', '在出發前使用穩定網路完成安裝'],
    faqs: [
      { question: '外國旅客可以使用台灣 eSIM 嗎？', answer: '手機支援 eSIM 且未鎖定特定電信商即可使用，個別方案如有身分驗證要求會在備註中說明。' },
      { question: '台灣 eSIM 可以分享熱點嗎？', answer: '熱點功能與分享額度依方案而異，請依商品頁說明選擇。' },
      { question: '台灣 eSIM 可以使用多久？', answer: '可依停留天數選擇不同效期，購買前請確認起算方式與有效天數。' }
    ]
  }
];

export function getEsimDestination(slug: string) {
  return ESIM_DESTINATIONS.find(destination => destination.slug === slug) || null;
}

export function getEsimDestinationForCountry(country: string) {
  return ESIM_DESTINATIONS.find(destination => destination.countries.includes(country)) || null;
}

export function isValidAutomaticEsimCountry(country: string) {
  return /^[\p{L}\p{N} .·-]{1,40}$/u.test(country.trim());
}

export function createAutomaticEsimDestination(country: string): EsimDestination | null {
  const normalizedCountry = country.trim();
  if (!isValidAutomaticEsimCountry(normalizedCountry)) return null;

  return {
    slug: normalizedCountry,
    name: `${normalizedCountry} eSIM`,
    shortName: normalizedCountry,
    flag: '🌍',
    countries: [normalizedCountry],
    title: `${normalizedCountry} eSIM｜旅遊網卡與行動上網方案`,
    description: `比較 ${normalizedCountry} eSIM 的使用天數、流量、價格與熱點分享規則，依旅遊行程挑選適合的行動上網方案。`,
    intro: `前往 ${normalizedCountry} 旅遊或出差，可依停留天數、日常通訊、導航與影音需求挑選 ${normalizedCountry} eSIM，免更換實體 SIM 卡。`,
    keywords: [`${normalizedCountry} eSIM`, `${normalizedCountry}網卡`, `${normalizedCountry}上網`, `${normalizedCountry}旅遊網路`],
    highlights: [
      '將抵達日與離境日納入方案天數',
      '依地圖、社群、影音與工作需求估算流量',
      '於啟用日前或旅程出發前，在穩定網路環境完成安裝'
    ],
    faqs: [
      {
        question: `${normalizedCountry} eSIM 要如何挑選？`,
        answer: `先確認前往地區包含在方案範圍內，再依 ${normalizedCountry} 停留天數、流量與熱點需求比較方案。`
      },
      {
        question: `${normalizedCountry} eSIM 可以分享熱點嗎？`,
        answer: '不同方案的熱點支援與額度不同，購買前請查看方案卡片上的熱點分享說明。'
      },
      {
        question: `${normalizedCountry} eSIM 什麼時候安裝？`,
        answer: '建議於啟用日前或旅程出發前，在穩定 Wi-Fi 環境完成安裝，並依方案說明啟用行動數據。'
      }
    ]
  };
}

export function getEsimDestinationHref(destination: EsimDestination) {
  return `/esim/${encodeURIComponent(destination.slug)}`;
}
