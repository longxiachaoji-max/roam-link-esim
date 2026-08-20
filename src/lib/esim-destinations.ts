export interface EsimDestinationFaq {
  question: string;
  answer: string;
}

export interface EsimDestinationGuide {
  title: string;
  body: string;
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
  guides?: EsimDestinationGuide[];
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
    description: '比較日本 eSIM、日本網卡吃到飽、每日流量與總量型方案，依旅遊天數、KDDI 或 SoftBank 網路、熱點需求及使用量選擇。',
    intro: '規劃日本自由行時，可依東京、大阪、京都、北海道或沖繩的旅程天數與使用量，選擇免換實體卡的日本 eSIM。方案涵蓋吃到飽、每日流量、總量型，以及 KDDI、SoftBank 等日本網路選擇。',
    keywords: [
      '日本 eSIM',
      '日本網卡',
      '日本網卡推薦',
      '日本 eSIM 推薦',
      '日本 eSIM 吃到飽',
      '日本網卡吃到飽',
      '日本旅遊網卡',
      '日本上網卡',
      'KDDI eSIM',
      'SoftBank eSIM',
      '東京網卡',
      '大阪網卡'
    ],
    highlights: ['依實際旅遊天數選擇，避免購買過多效期', '比較 KDDI、SoftBank 等網路與方案使用規則', '需要分享給同行裝置時，先確認熱點額度'],
    guides: [
      {
        title: '日本網卡與日本 eSIM 怎麼選？',
        body: '「日本網卡」是旅客常用的上網方案搜尋方式；本站目前提供免拆換原本 SIM 卡的日本 eSIM。挑選時應先確認手機支援 eSIM，再依旅遊天數、流量與熱點需求比較。'
      },
      {
        title: '日本網卡吃到飽還是流量型比較適合？',
        body: '經常觀看影片、直播、上傳大量照片或分享熱點，可優先比較吃到飽及高速流量較高的方案。主要使用地圖、通訊與查詢資訊，則每日流量或總量型方案通常更容易控制預算。'
      },
      {
        title: 'KDDI 與 SoftBank 日本網路方案',
        body: '部分日本 eSIM 會標示 KDDI、SoftBank 或其他當地合作網路。不同方案的涵蓋、限速、熱點與啟用規則可能不同，應以商品頁顯示的電信網路及備註為準。'
      }
    ],
    faqs: [
      { question: '日本 eSIM 要選吃到飽還是流量型？', answer: '會長時間使用地圖、社群與影音可優先比較吃到飽方案；一般查詢與通訊可依每日或總流量選擇。' },
      { question: '日本 eSIM 可以分享熱點嗎？', answer: '不同方案的熱點規則不同，可能是每日額度或總量額度，請以方案頁顯示的熱點分享說明為準。' },
      { question: '日本 eSIM 什麼時候安裝？', answer: '建議在啟用日前或旅程出發前，於穩定網路環境完成安裝，抵達後再依方案說明開啟行動數據。' },
      { question: '日本網卡可以在東京、大阪和北海道使用嗎？', answer: '日本全國型方案通常可跨城市使用，實際訊號會依所在地、地形與合作電信網路涵蓋而異。' },
      { question: '日本 eSIM 需要拔掉原本的 SIM 卡嗎？', answer: '不需要。支援雙 SIM 的手機可以保留原門號接收簡訊，同時將行動數據切換到日本 eSIM。' }
    ]
  },
  {
    slug: 'korea',
    name: '韓國 eSIM',
    shortName: '韓國',
    flag: '🇰🇷',
    countries: ['韓國'],
    title: '韓國 eSIM 推薦｜韓國網卡、吃到飽與 SKT 上網方案',
    description: '比較韓國 eSIM、韓國網卡吃到飽、每日流量與總量型方案，適合首爾、釜山與濟州島旅遊，依天數、網路及熱點需求選擇。',
    intro: '前往韓國自由行，地圖導航、查詢地鐵、叫車、翻譯與社群分享都需要行動網路。可依首爾、釜山、濟州島行程，比較韓國 eSIM 吃到飽、每日流量與總量型方案。',
    keywords: [
      '韓國 eSIM',
      '韓國 eSIM 推薦',
      '韓國網卡',
      '韓國網卡推薦',
      '韓國 eSIM 吃到飽',
      '韓國網卡吃到飽',
      '韓國旅遊網卡',
      '韓國上網卡',
      '首爾 eSIM',
      '釜山 eSIM',
      '濟州島 eSIM',
      'SKT eSIM'
    ],
    highlights: ['依地圖、交通、社群與影音需求估算流量', '比較 SKT、LG U+ 等當地合作網路與方案規則', '需要分享給同行裝置時，先查看熱點支援與額度'],
    guides: [
      {
        title: '韓國網卡與韓國 eSIM 怎麼選？',
        body: '手機支援 eSIM 且未鎖定電信商，即可免拆換原本 SIM 卡，並保留台灣門號接收簡訊。挑選時將抵達日與離境日納入，再比較方案起算方式。'
      },
      {
        title: '韓國 eSIM 吃到飽還是流量型？',
        body: '經常看影片、直播、上傳高畫質照片或分享熱點，可優先比較吃到飽或高速額度較高的方案。主要查地圖、交通與通訊，每日或總量型通常就足夠。'
      },
      {
        title: '首爾、釜山與濟州島網路選擇',
        body: '韓國方案可能使用 SKT、LG U+ 或其他當地合作網路。都市、地下空間、郊區與離島的實際訊號會受基地台與環境影響，請以方案頁涵蓋與電信資訊為準。'
      }
    ],
    faqs: [
      { question: '韓國 eSIM 可以在首爾、釜山和濟州島使用嗎？', answer: '韓國全國型方案通常可於主要旅遊地區使用，實際訊號會依當地合作網路、所在位置與地形而異。' },
      { question: '去韓國幾天要買幾天方案？', answer: '建議將抵達日與離境日都算入，並確認方案是依曆日或連續 24 小時起算。' },
      { question: '韓國 eSIM 吃到飽和流量型怎麼選？', answer: '影音、直播或熱點需求高可比較吃到飽；以地圖、交通、通訊和查詢資訊為主，可依每日或總流量選擇。' },
      { question: '韓國 eSIM 可以分享熱點嗎？', answer: '熱點支援與額度依方案不同，購買前請查看方案頁的熱點分享說明。' },
      { question: '韓國 eSIM 什麼時候安裝？', answer: '建議於啟用日前或旅程出發前，在穩定網路環境完成安裝，抵達後依方案說明開啟數據漫遊。' },
      { question: '韓國 eSIM 需要換掉原本 SIM 卡嗎？', answer: '不需要拔除原本 SIM 卡；支援雙 SIM 的手機可保留原門號接收簡訊，同時使用 eSIM 上網。' }
    ]
  },
  {
    slug: 'thailand',
    name: '泰國 eSIM',
    shortName: '泰國',
    flag: '🇹🇭',
    countries: ['泰國'],
    title: '泰國 eSIM 推薦｜泰國網卡、吃到飽與曼谷上網方案',
    description: '比較泰國 eSIM、泰國網卡吃到飽、每日流量與總量型方案，適合曼谷、清邁、普吉島與芭達雅旅遊，依天數、電信網路及熱點需求選擇。',
    intro: '規劃泰國自由行時，叫車、地圖、翻譯、行動支付與社群分享都需要穩定網路。可依曼谷、清邁、普吉島或芭達雅的行程天數，比較泰國 eSIM 吃到飽、每日流量與總量型方案，免拆換原本 SIM 卡。',
    keywords: [
      '泰國 eSIM',
      '泰國 eSIM 推薦',
      '泰國網卡',
      '泰國網卡推薦',
      '泰國 eSIM 吃到飽',
      '泰國網卡吃到飽',
      '泰國旅遊網卡',
      '泰國上網卡',
      '曼谷 eSIM',
      '清邁網卡',
      '普吉島 eSIM',
      'TRUE eSIM',
      'DTAC eSIM'
    ],
    highlights: ['依叫車、地圖、社群與影音需求比較流量', '跨城市旅遊時確認方案涵蓋地區與合作網路', '需要分享給同行裝置時，先查看熱點支援與額度'],
    guides: [
      {
        title: '泰國網卡與泰國 eSIM 怎麼選？',
        body: '支援 eSIM 的手機可直接掃描安裝資訊，不必拔除原本 SIM 卡，也能保留原門號接收簡訊。選購前先確認手機支援 eSIM 且未鎖定電信商，再依完整旅遊天數比較方案。'
      },
      {
        title: '泰國 eSIM 吃到飽還是流量型？',
        body: '長時間觀看影片、直播、上傳照片或分享熱點，可優先比較吃到飽及高速流量較高的方案。主要使用 Grab、Google Maps、LINE 與查詢景點，則每日流量或總量型通常較容易控制預算。'
      },
      {
        title: '曼谷、清邁與普吉島的網路選擇',
        body: '泰國方案可能使用 TRUE、DTAC 或其他當地合作網路，適用城市、最高速率、熱點與實名驗證規則會依商品不同。前往離島、山區或跨城市移動時，請以方案頁標示的涵蓋地區與電信網路為準。'
      }
    ],
    faqs: [
      { question: '泰國 eSIM 可以在曼谷、清邁和普吉島使用嗎？', answer: '泰國全國型方案通常可在主要旅遊城市使用，實際訊號仍會依合作電信網路、所在地形與基地台涵蓋而異。' },
      { question: '去泰國幾天要買幾天方案？', answer: '建議把抵達日與離境日都算入，並確認方案採曆日制或 24 小時計算。' },
      { question: '泰國 eSIM 吃到飽和流量型怎麼選？', answer: '影音、直播或熱點需求高可比較吃到飽方案；以叫車、地圖、通訊和查詢資訊為主，可依每日流量或總量型方案控制預算。' },
      { question: '泰國 eSIM 可以分享熱點嗎？', answer: '不同方案可能支援熱點、限制分享額度或不開放分享，請以各方案頁的熱點說明為準。' },
      { question: '泰國 eSIM 安裝後就開始計算嗎？', answer: '各方案啟用規則不同，請依商品說明操作；建議於啟用日前或旅程出發前在穩定網路環境完成安裝。' },
      { question: '泰國 eSIM 需要實名認證嗎？', answer: '部分當地電信方案可能要求 KYC 實名驗證，未標示 KYC 的方案則依商品頁規則辦理，購買前請先查看備註。' }
    ]
  },
  {
    slug: 'vietnam',
    name: '越南 eSIM',
    shortName: '越南',
    flag: '🇻🇳',
    countries: ['越南'],
    title: '越南 eSIM 推薦｜越南網卡、吃到飽與旅遊上網',
    description: '比較越南 eSIM、越南網卡吃到飽、每日流量與總量型方案，適合河內、胡志明市、峴港與富國島旅遊上網。',
    intro: '越南自由行常用 Google Maps、Grab、翻譯、餐廳查詢與社群分享。可依河內、下龍灣、峴港、會安、胡志明市或富國島行程，比較越南 eSIM 天數、流量與熱點規則。',
    keywords: [
      '越南 eSIM',
      '越南 eSIM 推薦',
      '越南網卡',
      '越南網卡推薦',
      '越南 eSIM 吃到飽',
      '越南網卡吃到飽',
      '越南旅遊網卡',
      '越南上網卡',
      '河內 eSIM',
      '胡志明市網卡',
      '峴港 eSIM',
      '富國島 eSIM'
    ],
    highlights: ['多城市移動時，依完整行程挑選天數與涵蓋', '依叫車、地圖、社群與影音需求估算流量', '離島或郊區行程先查看合作電信網路與備註'],
    guides: [
      {
        title: '越南網卡與越南 eSIM 怎麼選？',
        body: '支援 eSIM 的手機可免更換實體 SIM 卡，並保留原門號接收簡訊。先確認手機未鎖定電信商，再依旅遊天數、使用量與熱點需求比較。'
      },
      {
        title: '越南 eSIM 吃到飽還是流量型？',
        body: '如果需要長時間看影片、工作視訊、上傳照片或分享熱點，可比較吃到飽與較大高速額度。只使用 Grab、地圖、LINE 與查詢資訊，可選每日或總量型。'
      },
      {
        title: '河內、峴港與胡志明市網路選擇',
        body: '越南全國型方案通常可跨城市使用，但不同方案的合作電信、最高速率、熱點與離島訊號可能不同，請以方案頁說明為準。'
      }
    ],
    faqs: [
      { question: '越南 eSIM 可以在河內、峴港與胡志明市使用嗎？', answer: '越南全國型方案通常可跨城市使用，實際連線品質依合作電信網路、所在位置與地形而定。' },
      { question: '去越南幾天要買幾天方案？', answer: '建議將抵達日與離境日都算入，並查看方案是以曆日或連續 24 小時起算。' },
      { question: '越南旅遊需要多少流量？', answer: '以地圖、通訊和叫車為主可選每日或總量型；常看影片、直播、工作或分享熱點則建議比較較大流量。' },
      { question: '越南 eSIM 可以分享熱點嗎？', answer: '部分方案可分享熱點，但可能有每日或總量額度，請以商品頁熱點說明為準。' },
      { question: '越南 eSIM 什麼時候安裝？', answer: '建議於啟用日前或旅程出發前，依會員中心安裝資訊，在穩定 Wi-Fi 環境完成設定。' },
      { question: '越南 eSIM 需要更換原本 SIM 卡嗎？', answer: '不需要。支援雙 SIM 的手機可保留原門號接收簡訊，並將行動數據切換到越南 eSIM。' }
    ]
  },
  {
    slug: 'china',
    name: '中國 eSIM',
    shortName: '中國',
    flag: '🇨🇳',
    countries: ['中國'],
    title: '中國 eSIM 推薦｜中國網卡、大陸旅遊與行動上網',
    description: '比較中國 eSIM、中國旅遊網卡、每日流量與總量型方案，依大陸旅遊或出差天數、熱點與網路使用需求選擇。',
    intro: '前往中國旅遊、探親或出差，可依北京、上海、廣州、深圳、成都等行程天數，比較中國 eSIM 的流量、熱點與漫遊路由。不同方案的常用服務及限制可能不同，購買前請查看備註。',
    keywords: [
      '中國 eSIM',
      '中國 eSIM 推薦',
      '中國網卡',
      '中國網卡推薦',
      '中國旅遊網卡',
      '中國上網卡',
      '大陸 eSIM',
      '大陸網卡',
      '中國 eSIM 吃到飽',
      '中國漫遊網路',
      '上海 eSIM',
      '北京 eSIM'
    ],
    highlights: ['依常用應用、工作與行程需求比較漫遊路由', '視訊、檔案傳輸或熱點使用可選較大高速流量', '購買前仔細查看方案的網路服務、備註與安裝限制'],
    guides: [
      {
        title: '中國網卡與中國 eSIM 怎麼選？',
        body: '支援 eSIM 的手機可免拆換原本 SIM 卡，並保留原門號接收簡訊。挑選時除了天數與流量，還要查看合作網路、漫遊路由、熱點及備註限制。'
      },
      {
        title: '旅遊與出差要選多少流量？',
        body: '日常地圖、通訊、叫車與行動支付可依每日或總量型挑選。如需要工作視訊、傳送檔案、長時間影音或分享熱點，建議預留更多高速流量。'
      },
      {
        title: '購買中國 eSIM 前為何要看備註？',
        body: '中國 eSIM 方案的漫遊路由、可使用服務、最高速率、熱點與實名規則可能不同。為避免與實際用途不符，請以每個方案頁顯示的資訊為準。'
      }
    ],
    faqs: [
      { question: '中國 eSIM 可以使用哪些網路服務？', answer: '不同漫遊路由與方案規則可能不同，請以各方案備註列出的網路服務及限制為準。' },
      { question: '中國 eSIM 可以跨城市使用嗎？', answer: '中國全國型方案通常可跨城市使用，實際訊號會依當地合作網路、位置與地形而異。' },
      { question: '中國 eSIM 能分享熱點嗎？', answer: '部分方案可分享熱點，但額度與規則不同，請在購買前查看熱點說明。' },
      { question: '中國 eSIM 適合出差使用嗎？', answer: '可依工作天數、視訊與檔案傳輸量選擇方案，重要工作建議預留足夠流量，並先確認常用服務的備註。' },
      { question: '中國 eSIM 什麼時候安裝？', answer: '建議於啟用日前或旅程出發前，在穩定 Wi-Fi 環境依會員中心提供的資訊完成安裝。' },
      { question: '中國 eSIM 需要實名認證嗎？', answer: '部分方案可能要求 KYC 實名驗證，實際規則請以商品頁備註為準。' }
    ]
  },
  {
    slug: 'greater-china',
    name: '中港澳 eSIM',
    shortName: '中港澳',
    flag: '🌏',
    countries: ['中國 香港 澳門'],
    title: '中港澳 eSIM 推薦｜中國、香港、澳門跨區網卡',
    description: '比較中港澳 eSIM、香港澳門網卡、每日流量與總量型方案，一張 eSIM 適用中國、香港與澳門跨境行程。',
    intro: '行程同時包含中國、香港與澳門時，中港澳多地區 eSIM 可減少每次跨境重新換卡或購買多張網卡的麻煩。可依完整旅遊天數、流量、熱點與三地涵蓋範圍比較方案。',
    keywords: [
      '中港澳 eSIM',
      '中港澳 eSIM 推薦',
      '中港澳網卡',
      '中港澳上網卡',
      '香港 eSIM',
      '香港網卡',
      '澳門 eSIM',
      '澳門網卡',
      '香港澳門 eSIM',
      '中國香港澳門上網',
      '大灣區 eSIM',
      '中港澳吃到飽'
    ],
    highlights: ['跨境行程先確認中國、香港與澳門皆在涵蓋範圍', '依完整旅程而非單一城市計算天數與流量', '切換地區後裝置會改連當地合作網路，不需重新安裝'],
    guides: [
      {
        title: '中港澳 eSIM 適合什麼行程？',
        body: '如果旅程會往返中國、香港與澳門，多地區 eSIM 可使用同一份安裝資訊連接各地合作網路。若只前往單一地區，也可再比較單地方案。'
      },
      {
        title: '中港澳網卡天數與流量怎麼算？',
        body: '請將第一地抵達日到最後一地離境日全部納入，並查看方案是每日重置、全程共用總量，或達量後降速。'
      },
      {
        title: '跨境後需要重新設定嗎？',
        body: '一般不需重新安裝 eSIM。跨境後裝置會搜尋新地區的合作網路；若未自動連線，可稍候片刻、開關飛航模式，再依方案說明選擇網路。'
      }
    ],
    faqs: [
      { question: '中港澳 eSIM 可以三地共用嗎？', answer: '標示為中港澳的方案涵蓋中國、香港與澳門，仍請以商品頁的實際涵蓋地區為準。' },
      { question: '只去香港也能買中港澳方案嗎？', answer: '可以，但若只停留單一地區，也可比較單國或單地區方案是否更符合流量與價格需求。' },
      { question: '中港澳 eSIM 可以分享熱點嗎？', answer: '不同方案可能支援熱點、限制額度或不開放分享，請以各方案頁的熱點說明為準。' },
      { question: '中港澳 eSIM 的流量是三地共用嗎？', answer: '總量型方案通常由全程共用，每日型則依當日額度使用，實際計算請以商品頁為準。' },
      { question: '跨境後需要重新安裝 eSIM 嗎？', answer: '通常不需要重新安裝；抵達新地區後裝置會搜尋可用合作網路，必要時可重新開關飛航模式。' },
      { question: '中港澳 eSIM 什麼時候安裝？', answer: '建議於啟用日前或旅程出發前，在穩定網路環境完成安裝，抵達後依方案說明開啟行動數據。' }
    ]
  },
  {
    slug: 'taiwan',
    name: '台灣 eSIM',
    shortName: '台灣',
    flag: '🇹🇼',
    countries: ['台灣'],
    title: '台灣 eSIM 推薦｜台灣網卡、吃到飽與旅遊上網',
    description: '比較台灣 eSIM、台灣旅遊網卡、吃到飽與流量型方案，適合來台旅客依停留天數、行程地區與熱點需求選擇。',
    intro: '來台旅遊、探親、出差或短期停留，可使用台灣 eSIM 連接行動網路。依台北、台中、台南、高雄、花蓮或環島行程，比較使用天數、流量、當地合作網路與熱點規則。',
    keywords: [
      '台灣 eSIM',
      '台灣 eSIM 推薦',
      '台灣網卡',
      '台灣網卡推薦',
      '台灣 eSIM 吃到飽',
      '台灣旅遊網卡',
      '台灣上網卡',
      '台灣預付網卡',
      '台北 eSIM',
      '高雄 eSIM',
      'Taiwan eSIM',
      'Taiwan tourist eSIM'
    ],
    highlights: ['依抵台與離台日期計算完整方案天數', '比較當地合作網路、高速流量與熱點規則', '都市以外、山區或環島行程先確認涵蓋需求'],
    guides: [
      {
        title: '來台旅遊要選台灣網卡還是 eSIM？',
        body: '手機支援 eSIM 且未鎖定電信商，可在出發前完成安裝，不需更換原本 SIM 卡。挑選時依停留天數、每日使用量、熱點與實名規則比較。'
      },
      {
        title: '台灣 eSIM 吃到飽還是流量型？',
        body: '長時間導航、看影片、視訊、上傳旅遊照片或分享熱點，可優先比較吃到飽或較大高速額度。主要使用地圖、通訊與查詢資訊，流量型通常足夠。'
      },
      {
        title: '台北、台中、高雄與環島網路選擇',
        body: '台灣全國型方案通常可跨縣市使用，實際訊號會依合作電信網路、室內環境、山區與離島位置而異，請以方案頁資訊為準。'
      }
    ],
    faqs: [
      { question: '外國旅客可以使用台灣 eSIM 嗎？', answer: '手機支援 eSIM 且未鎖定特定電信商即可使用，個別方案如有身分驗證要求會在備註中說明。' },
      { question: '台灣 eSIM 可以在台北、台中、台南與高雄使用嗎？', answer: '台灣全國型方案通常可跨縣市使用，實際訊號會依合作網路、位置與地形而異。' },
      { question: '台灣 eSIM 可以分享熱點嗎？', answer: '熱點功能與分享額度依方案而異，請依商品頁說明選擇。' },
      { question: '台灣 eSIM 可以使用多久？', answer: '可依停留天數選擇不同效期，購買前請確認起算方式與有效天數。' },
      { question: '台灣 eSIM 什麼時候安裝？', answer: '建議於啟用日前或旅程出發前，使用穩定 Wi-Fi 完成安裝，抵台後依方案說明開啟行動數據。' },
      { question: '台灣 eSIM 需要實名認證嗎？', answer: '部分方案可能有 KYC 或身分驗證要求，若有要求會依商品頁備註說明。' }
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
    title: `${normalizedCountry} eSIM 推薦｜${normalizedCountry}網卡、流量與吃到飽方案`,
    description: `比較 ${normalizedCountry} eSIM、${normalizedCountry}網卡、吃到飽、每日流量與總量型方案，依旅遊天數、價格、熱點與使用量選擇。`,
    intro: `前往 ${normalizedCountry} 旅遊或出差，地圖導航、叫車、翻譯、日常通訊與社群分享都需要行動網路。可依完整行程天數與使用量，比較 ${normalizedCountry} eSIM 吃到飽、每日流量與總量型方案，免更換實體 SIM 卡。`,
    keywords: [
      `${normalizedCountry} eSIM`,
      `${normalizedCountry} eSIM 推薦`,
      `${normalizedCountry}網卡`,
      `${normalizedCountry}網卡推薦`,
      `${normalizedCountry}上網卡`,
      `${normalizedCountry}旅遊網卡`,
      `${normalizedCountry} eSIM 吃到飽`,
      `${normalizedCountry}網卡吃到飽`,
      `${normalizedCountry}每日流量 eSIM`,
      `${normalizedCountry}總量型網卡`
    ],
    highlights: [
      '將抵達日與離境日納入方案天數，並確認起算方式',
      '依地圖、社群、影音、工作與熱點需求估算流量',
      '購買前查看涵蓋地區、合作網路、KYC 與安裝備註'
    ],
    guides: [
      {
        title: `${normalizedCountry}網卡與 ${normalizedCountry} eSIM 怎麼選？`,
        body: `手機支援 eSIM 且未鎖定電信商，即可免拆換原本 SIM 卡，並保留原門號接收簡訊。挑選 ${normalizedCountry} 方案時，先確認涵蓋地區，再比較天數、流量、熱點與備註。`
      },
      {
        title: `${normalizedCountry} eSIM 吃到飽還是流量型？`,
        body: '長時間看影片、直播、上傳照片、工作視訊或分享熱點，可優先比較吃到飽與較大高速額度。以地圖、通訊、叫車與查詢資訊為主，可依每日或總量型選擇。'
      },
      {
        title: `購買 ${normalizedCountry} eSIM 前要確認什麼？`,
        body: `請確認手機支援 eSIM、方案涵蓋 ${normalizedCountry} 的實際旅遊地區，並查看天數起算、熱點、降速、KYC 與是否可重複安裝等備註。`
      }
    ],
    faqs: [
      {
        question: `${normalizedCountry} eSIM 要如何挑選？`,
        answer: `先確認前往地區包含在方案範圍內，再依 ${normalizedCountry} 停留天數、流量與熱點需求比較方案。`
      },
      {
        question: `${normalizedCountry} eSIM 吃到飽和流量型怎麼選？`,
        answer: '影音、工作或熱點需求高可比較吃到飽；以地圖、叫車、通訊和查詢資訊為主，可依每日或總流量選擇。'
      },
      {
        question: `${normalizedCountry} eSIM 可以分享熱點嗎？`,
        answer: '不同方案的熱點支援與額度不同，購買前請查看方案卡片上的熱點分享說明。'
      },
      {
        question: `${normalizedCountry} eSIM 什麼時候安裝？`,
        answer: '建議於啟用日前或旅程出發前，在穩定 Wi-Fi 環境完成安裝，並依方案說明啟用行動數據。'
      },
      {
        question: `${normalizedCountry} eSIM 需要更換原本 SIM 卡嗎？`,
        answer: '不需要。支援雙 SIM 的手機可保留原門號接收簡訊，並將行動數據切換到旅遊 eSIM。'
      },
      {
        question: `${normalizedCountry} eSIM 需要實名認證嗎？`,
        answer: '部分方案可能要求 KYC 實名驗證，若商品頁未標示則依該方案規則辦理，購買前請查看備註。'
      }
    ]
  };
}

export function getEsimDestinationHref(destination: EsimDestination) {
  return `/esim/${encodeURIComponent(destination.slug)}`;
}
