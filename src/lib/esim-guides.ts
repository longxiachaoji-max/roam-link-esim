export interface EsimGuideSource {
  label: string;
  href: string;
}

export interface EsimGuide {
  slug: string;
  destinationSlug: string;
  name: string;
  flag: string;
  priorityRank: number | null;
  outboundCount: number | null;
  title: string;
  description: string;
  keywords: string[];
  intro: string;
  lightUse: string;
  normalUse: string;
  heavyUse: string;
  cities: string[];
  networks: string[];
  networkAdvice: string;
  specialHeading: string;
  specialChecks: string[];
  faqs: Array<{ question: string; answer: string }>;
  sources: EsimGuideSource[];
}

export const OUTBOUND_RANKING_SOURCE: EsimGuideSource = {
  label: '交通部觀光署：2025 年中華民國國民出國統計',
  href: 'https://admin.taiwan.net.tw/fapi/AttFile?id=40606&type=AttFile'
};

export const COMMON_DEVICE_SOURCES: EsimGuideSource[] = [
  { label: 'Apple：出國時在 iPhone 上使用 eSIM', href: 'https://support.apple.com/zh-tw/118227' },
  { label: 'Apple：在 iPhone 上設定 eSIM', href: 'https://support.apple.com/zh-tw/118669' },
  { label: 'Google Pixel：進一步瞭解 eSIM', href: 'https://support.google.com/pixelphone/answer/16115741?hl=zh-Hant' },
  { label: 'Samsung 台灣：Galaxy eSIM 與支援的電信業者', href: 'https://www.samsung.com/tw/support/mobile-devices/galaxy-esim-and-supported-network-carriers/' }
];

export const ESIM_GUIDES: EsimGuide[] = [
  {
    slug: 'korea-esim',
    destinationSlug: 'korea',
    name: '韓國',
    flag: '🇰🇷',
    priorityRank: 3,
    outboundCount: 1_835_061,
    title: '韓國 eSIM 怎麼選？韓國網卡吃到飽、流量與 SKT／KT／LG U+ 比較',
    description: '韓國 eSIM 完整選購指南：依首爾、釜山、濟州島行程比較韓國網卡吃到飽、每日流量與總量型，並確認 SKT、KT、LG U+、熱點、啟用及手機相容性。',
    keywords: ['韓國 eSIM 怎麼選', '韓國 eSIM 推薦', '韓國網卡吃到飽', '韓國 SIM 卡', '首爾 eSIM', '釜山 eSIM', '濟州島 eSIM', 'SKT eSIM'],
    intro: '韓國自由行常同時使用地圖、地鐵查詢、翻譯、叫車與社群。先依每天的影音與上傳量選流量，再確認行程是否包含濟州島、郊區或大量地下空間，最後核對方案實際使用的網路與熱點規則。',
    lightUse: 'LINE、地鐵與地圖查詢、餐廳搜尋',
    normalUse: '導航、叫車、社群瀏覽、上傳照片與偶爾短影音',
    heavyUse: '直播、長時間影片、工作視訊、雲端備份或分享熱點',
    cities: ['首爾', '釜山', '濟州島', '仁川', '江原道'],
    networks: ['SK Telecom（SKT）', 'KT', 'LG U+'],
    networkAdvice: '不要只以「韓國吃到飽」判斷訊號。先看商品標示的合作網路，再依住宿、滑雪場、濟州島自駕或郊區路線查看該電信業者資訊。地鐵、地下街、高樓室內與壅塞時段的實際速度仍可能不同。',
    specialHeading: '韓國行程特別要確認',
    specialChecks: [
      '濟州島、滑雪場或郊區行程，是否在商品標示的服務範圍內。',
      '方案標示 5G 不代表所有地點都能連上 5G；手機頻段、方案權限與當地涵蓋都會影響。',
      '需要韓國電話號碼收驗證碼或訂位時，確認商品是否只有數據；旅遊 eSIM 不一定附當地門號。',
      '熱點分享、語音通話與簡訊是三件不同的功能，不能因為能上網就推定全部支援。'
    ],
    faqs: [
      { question: '韓國 eSIM 可以在首爾、釜山和濟州島使用嗎？', answer: '標示韓國全國涵蓋的方案通常可跨城市使用，但濟州島、山區、室內與地下空間的訊號仍受合作網路及所在地影響，應以商品涵蓋與當地網路資訊為準。' },
      { question: 'SKT、KT 和 LG U+ 哪一個比較好？', answer: '沒有適合所有地點與手機的固定答案。應先確認方案實際連接哪一家網路，再依主要停留地、裝置頻段與行程查看涵蓋；漫遊路由與尖峰壅塞也可能影響速度。' },
      { question: '韓國 eSIM 有附韓國電話號碼嗎？', answer: '多數旅遊 eSIM 以數據服務為主，不應預設包含韓國門號、語音或簡訊。若訂位或驗證必須使用韓國號碼，請選購前確認商品功能。' }
    ],
    sources: [
      { label: 'Apple：南韓支援 eSIM 的電信業者', href: 'https://support.apple.com/zh-tw/101569?choose-a-country-or-region=south-korea' }
    ]
  },
  {
    slug: 'china-esim',
    destinationSlug: 'china',
    name: '中國',
    flag: '🇨🇳',
    priorityRank: 2,
    outboundCount: 3_237_511,
    title: '中國 eSIM 怎麼選？大陸網卡流量、漫遊路由與常用服務說明',
    description: '中國 eSIM 完整選購指南：比較大陸旅遊網卡的每日流量、總量型、吃到飽、漫遊路由、常用服務、熱點與手機相容性，適合旅遊、探親及出差。',
    keywords: ['中國 eSIM 怎麼選', '中國 eSIM 推薦', '大陸網卡', '中國旅遊網卡', '中國 eSIM 吃到飽', '上海 eSIM', '北京 eSIM', '中國漫遊網路'],
    intro: '中國旅遊或出差除了天數與流量，還要確認漫遊路由、常用 App、公司 VPN、熱點及裝置來源。不同商品可能透過不同境外漫遊網路連線，能使用哪些服務不能只看「中國 eSIM」名稱推定。',
    lightUse: '地圖、通訊、叫車、行動支付與基本網頁',
    normalUse: '社群、照片上傳、導航、工作郵件與短影音',
    heavyUse: '視訊會議、大檔案、直播、長時間影音或筆電熱點',
    cities: ['上海', '北京', '深圳', '廣州', '成都'],
    networks: ['中國移動', '中國聯通', '中國電信'],
    networkAdvice: '商品標示當地合作電信，只代表可能使用的無線網路之一；旅遊 eSIM 還可能經由境外漫遊路由傳輸資料。實際延遲、可用服務與最高速率會因商品路由、所在地、手機頻段及壅塞而異。',
    specialHeading: '中國方案最容易買錯的地方',
    specialChecks: [
      '需要使用 Google、LINE、Instagram、公司 VPN 或特定工作系統時，逐項確認商品備註；不要把所有中國 eSIM 視為相同。',
      '中國大陸販售的 iPhone 機型有特殊 eSIM 限制；手機購買地與型號必須一起核對。',
      '數據專用旅遊 eSIM 通常不提供中國門號、語音與簡訊，叫車或服務驗證若要求本地號碼需另作準備。',
      '出差需要視訊或傳檔時，除了流量也要考慮延遲；「5G」或「吃到飽」都不等於穩定低延遲。'
    ],
    faqs: [
      { question: '中國 eSIM 一定可以使用 Google、LINE 或 Instagram 嗎？', answer: '不能一概而論。可用服務取決於方案的漫遊路由與供應商規則，購買前必須查看商品備註；重要工作系統也應事先準備替代連線方式。' },
      { question: '在中國大陸買的 iPhone 都支援旅遊 eSIM 嗎？', answer: '不是。Apple 對中國大陸販售機型有獨立的 eSIM 支援與安裝限制，且規則可能隨機型更新。請依手機型號、購買地與 Apple 最新說明確認。' },
      { question: '中國 eSIM 有中國電話號碼嗎？', answer: '數據型旅遊 eSIM 通常不包含中國門號、語音或簡訊，不能用上網功能推定有本地號碼。若服務註冊需要中國門號，請先確認商品明確列有此功能。' }
    ],
    sources: [
      { label: 'Apple：在中國大陸透過 iPhone 使用 eSIM', href: 'https://support.apple.com/zh-tw/123879' },
      { label: 'Apple：出國時在 iPhone 上使用 eSIM', href: 'https://support.apple.com/zh-tw/118227' }
    ]
  },
  {
    slug: 'hong-kong-esim',
    destinationSlug: 'hong-kong',
    name: '香港',
    flag: '🇭🇰',
    priorityRank: 4,
    outboundCount: 1_626_176,
    title: '香港 eSIM 怎麼選？香港網卡吃到飽、流量與實名規則',
    description: '香港 eSIM 完整選購指南：比較香港網卡吃到飽、每日流量與總量型，說明本地預付卡實名登記、熱點、啟用時間、手機相容性及跨境需求。',
    keywords: ['香港 eSIM 怎麼選', '香港 eSIM 推薦', '香港網卡吃到飽', '香港旅遊網卡', '香港 SIM 卡', '香港上網卡', '香港 eSIM 實名'],
    intro: '香港行程常需要地圖、港鐵、叫車、餐廳查詢與行動支付。先依停留天數與流量挑選，再分清楚商品是香港本地發行的預付服務，還是由境外供應商提供的旅遊漫遊 eSIM，兩者的實名與啟用規則可能不同。',
    lightUse: '港鐵與地圖查詢、LINE、餐廳搜尋',
    normalUse: '導航、叫車、社群、照片上傳與短影音',
    heavyUse: '直播、工作視訊、雲端備份或分享熱點',
    cities: ['香港島', '九龍', '新界', '大嶼山', '離島'],
    networks: ['csl.', '3香港', 'SmarTone', '中國移動香港'],
    networkAdvice: '香港主要市區網路選擇多，但高樓室內、地下空間、郊野公園與離島仍可能有差異。商品使用哪一家網路、是否支援 5G、能否手動選網與實際漫遊路由，都應以方案頁為準。',
    specialHeading: '香港實名與跨境需求',
    specialChecks: [
      '香港通訊事務管理局規定，由香港本地電信商發出的 SIM 服務及預付 SIM 在啟用前須完成實名登記；旅客可依規定使用有效旅行證件。',
      '境外旅遊漫遊 eSIM 是否需要 KYC，取決於供應商與產品，不可直接套用本地卡流程。',
      '若行程會進入深圳或澳門，確認香港單地方案是否涵蓋；未標示的地區不要假設可以使用。',
      '香港版部分 iPhone 可能是雙 nano-SIM 型號，是否支援 eSIM 應以實際型號而非外觀判斷。'
    ],
    faqs: [
      { question: '香港 eSIM 一定需要實名認證嗎？', answer: '香港本地電信商發出的 SIM 服務與預付 SIM 依法須在啟用前完成實名登記；境外供應商的旅遊漫遊 eSIM 是否需要 KYC 則依商品規則。購買前請查看方案備註。' },
      { question: '香港 eSIM 可以到深圳或澳門使用嗎？', answer: '只有商品明確標示涵蓋中國或澳門時才能據此使用。香港單地方案不應假設能跨境；跨境行程可另比較中港澳方案。' },
      { question: '香港買的 iPhone 都能安裝 eSIM 嗎？', answer: '不是。香港與澳門販售的部分 iPhone 採雙 nano-SIM，eSIM 支援因型號而異；請在設定中確認「加入 eSIM」並核對 Apple 的機型說明。' }
    ],
    sources: [
      { label: '香港通訊事務管理局：電話智能卡實名登記制', href: 'https://www.ofca.gov.hk/simreg/' },
      { label: '香港通訊事務管理局：電信商實名登記連結', href: 'https://www.ofca.gov.hk/en/consumer_focus/guide/hot_topics/sim_registration/reference_guide/index.html' }
    ]
  },
  {
    slug: 'vietnam-esim',
    destinationSlug: 'vietnam',
    name: '越南',
    flag: '🇻🇳',
    priorityRank: 5,
    outboundCount: 1_214_362,
    title: '越南 eSIM 怎麼選？越南網卡流量、吃到飽與跨城市上網',
    description: '越南 eSIM 完整選購指南：比較越南網卡吃到飽、每日流量與總量型，適合河內、下龍灣、峴港、會安、胡志明市及富國島行程。',
    keywords: ['越南 eSIM 怎麼選', '越南 eSIM 推薦', '越南網卡吃到飽', '越南旅遊網卡', '河內 eSIM', '峴港 eSIM', '胡志明市 eSIM', '富國島 eSIM'],
    intro: '越南多城市行程常用 Grab、地圖、翻譯、餐廳查詢與社群。除了流量，跨城市或前往下龍灣、沙壩、富國島時更要確認合作網路與涵蓋，不要只用河內或胡志明市的市區體驗推定全程。',
    lightUse: 'Grab、地圖、LINE、翻譯與景點查詢',
    normalUse: '跨城導航、社群、照片上傳與短影音',
    heavyUse: '長時間影音、視訊、雲端備份或筆電熱點',
    cities: ['河內', '下龍灣', '峴港', '會安', '胡志明市', '富國島'],
    networks: ['Viettel', 'VinaPhone', 'MobiFone'],
    networkAdvice: '先確認商品實際使用的越南合作網路。都市、山區、海上交通、離島與室內環境可能有明顯差異；跨城市移動者應優先看完整路線，而不是只看單一城市是否有訊號。',
    specialHeading: '越南跨城市行程檢查',
    specialChecks: [
      '河內—下龍灣、峴港—會安或胡志明市—富國島等移動路線，確認是否全程涵蓋。',
      'Grab、地圖與翻譯是持續使用項目；若還會上傳高畫質影片，應增加流量預留。',
      '商品若標示當地門號、語音或簡訊，需另外確認 KYC；純數據旅遊 eSIM 不一定有本地號碼。',
      '離島、山區與交通途中訊號可能不連續，重要票券與住宿資料建議離線保存。'
    ],
    faqs: [
      { question: '越南 eSIM 可以從河內一路用到峴港、胡志明市嗎？', answer: '標示越南全國涵蓋的方案通常可跨城市使用，但交通途中、山區、離島與室內訊號仍依合作網路而異。請確認商品涵蓋並離線保存重要資料。' },
      { question: '去富國島可以使用越南 eSIM 嗎？', answer: '需確認商品涵蓋越南離島及其合作網路。即使方案可使用，島上不同地點與室內環境的訊號仍可能不同。' },
      { question: '越南 eSIM 有當地電話號碼嗎？', answer: '多數旅遊 eSIM 是數據型，不應預設包含越南號碼、語音或簡訊。如需要本地門號或收驗證碼，請選擇明確標示的商品並查看 KYC 規則。' }
    ],
    sources: [
      { label: 'Apple：越南支援 eSIM 的電信業者', href: 'https://support.apple.com/zh-tw/101569?choose-a-country-or-region=vietnam' },
      { label: 'Viettel Telecom 官方網站', href: 'https://vietteltelecom.vn/' }
    ]
  },
  {
    slug: 'thailand-esim',
    destinationSlug: 'thailand',
    name: '泰國',
    flag: '🇹🇭',
    priorityRank: 6,
    outboundCount: 1_026_976,
    title: '泰國 eSIM 怎麼選？泰國網卡吃到飽、流量與 AIS／True 比較',
    description: '泰國 eSIM 完整選購指南：比較泰國網卡吃到飽、每日流量與總量型，說明 AIS、True／dtac、KYC、熱點及曼谷、清邁、普吉島行程選擇。',
    keywords: ['泰國 eSIM 怎麼選', '泰國 eSIM 推薦', '泰國網卡吃到飽', '曼谷 eSIM', '清邁 eSIM', '普吉島 eSIM', 'AIS eSIM', 'True eSIM'],
    intro: '泰國旅遊常依賴 Grab、Google Maps、翻譯與社群。曼谷市區、清邁山區、普吉島及離島的環境不同，應先確認完整路線與合作網路，再依影音、直播和熱點需求選流量。',
    lightUse: 'Grab、地圖、LINE、翻譯與餐廳查詢',
    normalUse: '導航、社群、照片上傳與偶爾短影音',
    heavyUse: '直播、長時間影片、工作視訊或多人熱點',
    cities: ['曼谷', '清邁', '芭達雅', '普吉島', '蘇梅島'],
    networks: ['AIS', 'True／dtac'],
    networkAdvice: 'AIS 與 True／dtac 在泰國各地都有服務，但不能直接推定其中一家在所有景點都最好。山區、離島、船程、飯店室內及活動人潮都可能影響連線；方案是否能用 5G 也取決於商品、手機與所在地。',
    specialHeading: '泰國網卡常見限制',
    specialChecks: [
      '當地預付服務可能要求護照等 KYC；境外漫遊 eSIM 是否需要驗證，以商品流程為準。',
      '清邁山區、海島與船程請查看合作網路涵蓋，並離線保存船票、地址與接送資訊。',
      '吃到飽商品可能有高速額度或公平使用規則；「最高 5G」也不代表全程維持 5G。',
      '若要分享給同行者或筆電，確認熱點是否開放、分享額度是否另有限制。'
    ],
    faqs: [
      { question: '泰國 eSIM 可以在曼谷、清邁和普吉島使用嗎？', answer: '標示泰國全國涵蓋的方案通常可跨主要城市使用，但山區、離島、船程與室內訊號仍依合作網路及環境而異。' },
      { question: 'AIS 和 True／dtac 哪一家比較好？', answer: '沒有適合所有行程的固定答案。應確認商品使用的合作網路，再依主要景點、山區或離島行程查看涵蓋；手機頻段、漫遊路由與壅塞也會影響體驗。' },
      { question: '泰國 eSIM 需要護照實名嗎？', answer: '當地發行的預付服務可能要求身分驗證；境外供應商提供的旅遊漫遊 eSIM 則依商品規則。若需要 KYC，應以購買頁與安裝流程為準。' }
    ],
    sources: [
      { label: 'AIS：泰國服務區域查詢', href: 'https://retail.ais.th/coverage/index.html' },
      { label: 'Apple：泰國支援 eSIM 的電信業者', href: 'https://support.apple.com/zh-tw/101569?choose-a-country-or-region=thailand' }
    ]
  },
  {
    slug: 'indonesia-esim',
    destinationSlug: 'indonesia',
    name: '印尼',
    flag: '🇮🇩',
    priorityRank: 7,
    outboundCount: 162_169,
    title: '印尼 eSIM 怎麼選？峇里島網卡、流量與跨島上網指南',
    description: '印尼 eSIM 完整選購指南：比較峇里島與印尼網卡吃到飽、每日流量及總量型，說明 Telkomsel 等網路、跨島涵蓋、熱點、KYC 與手機設定。',
    keywords: ['印尼 eSIM 怎麼選', '印尼 eSIM 推薦', '峇里島 eSIM', '峇里島網卡', '巴厘島 eSIM', '印尼網卡吃到飽', 'Telkomsel eSIM', '雅加達 eSIM'],
    intro: '印尼由大量島嶼組成，峇里島南部、內陸山區、藍夢島、龍目島與爪哇城市的連線條件不同。先確認方案涵蓋完整跨島行程，再依 Grab、導航、照片上傳與熱點需求選擇流量。',
    lightUse: 'Grab、地圖、LINE、翻譯與餐廳查詢',
    normalUse: '導航、社群、照片上傳與短影音',
    heavyUse: '長時間影音、視訊、雲端備份或多人熱點',
    cities: ['峇里島', '雅加達', '日惹', '龍目島', '泗水'],
    networks: ['Telkomsel', 'Indosat', 'XL Axiata'],
    networkAdvice: '「印尼全國」不代表每一座島、山區與海上交通都有相同訊號。先確認商品合作網路，再依峇里島住宿區、內陸景點及跨島目的地查看涵蓋。Telkomsel 官方也提醒 5G 只在特定涵蓋區域，不能把 5G 當成全程保證。',
    specialHeading: '峇里島與跨島行程檢查',
    specialChecks: [
      '峇里島南部觀光區與烏布、火山周邊、離島的環境不同，要以完整路線評估。',
      '藍夢島、龍目島或其他跨島行程，確認商品不是只適用單一地區或特定網路區域。',
      '當地門號或預付服務可能涉及 KYC、裝置或 IMEI 規則；境外漫遊 eSIM 是否受影響應以商品說明為準。',
      '交通途中訊號可能中斷，船票、飯店地址、接送電話與地圖應先離線保存。'
    ],
    faqs: [
      { question: '峇里島 eSIM 可以在烏布和離島使用嗎？', answer: '是否涵蓋取決於商品與合作網路。峇里島南部、烏布山區及離島的訊號環境不同，不能只以機場或市區連線推定全程。' },
      { question: '印尼 eSIM 可以跨島使用嗎？', answer: '標示印尼全國涵蓋的方案通常可在多個城市或島嶼使用，但實際訊號仍依合作網路及目的地而異；海上與偏遠地區不應預設持續有訊號。' },
      { question: '印尼 eSIM 一定可以用 5G 嗎？', answer: '不一定。5G 需要商品開放、手機支援相關頻段且所在地有 5G 涵蓋。即使商品標示 5G，也可能在其他地點切換為 4G。' }
    ],
    sources: [
      { label: 'Telkomsel：印尼 4G 涵蓋查詢', href: 'https://www.telkomsel.com/4g-lte/4g-coverage' },
      { label: 'Telkomsel：5G 服務與涵蓋條件', href: 'https://www.telkomsel.com/en/5G' }
    ]
  },
  {
    slug: 'taiwan-esim',
    destinationSlug: 'taiwan',
    name: '台灣',
    flag: '🇹🇼',
    priorityRank: null,
    outboundCount: null,
    title: '台灣短期 eSIM 怎麼選？臨時上網免月租、免綁長約指南',
    description: '台灣短期 eSIM 完整指南：目前上架方案皆免 KYC、免證件核驗，適合來台旅遊、返台、出差、探親、活動工作與臨時備用網路。',
    keywords: ['台灣短期 eSIM', '台灣臨時網路', '台灣免綁約網卡', '台灣短期網卡', '台灣 eSIM 推薦', '來台 eSIM', '返台上網', '台灣旅遊網卡', '台灣 eSIM 吃到飽'],
    intro: '只在台灣停留幾天或幾週，不必為短期需求申辦月租門號或綁長約。可以依實際使用天數購買短期 eSIM，抵達後作為主要行動數據；返台探親、臨時出差、活動工作、原門號故障或需要備用網路也適用。',
    lightUse: 'LINE、地圖、叫車、電子票券、餐廳與交通查詢',
    normalUse: '導航、社群、照片上傳、行動辦公與偶爾短影音',
    heavyUse: '工作視訊、直播、長時間影片、雲端備份或筆電熱點',
    cities: ['台北', '台中', '台南', '高雄', '花東', '澎湖／金門／馬祖'],
    networks: ['中華電信', '台灣大哥大', '遠傳電信'],
    networkAdvice: '台灣本島主要城市通常都有行動網路服務，但地下空間、高樓室內、山區、花東縱谷、海岸公路及離島仍可能不同。先確認商品實際使用的合作網路；環島、自駕或登山行程應以完整路線查看官方涵蓋，不要只用台北市區的訊號推定全程。',
    specialHeading: '短期、免月租不代表功能都相同',
    specialChecks: [
      '「免綁長約」是指不用申辦月租型門號；購買的短期 eSIM 仍有明確效期、流量與使用條款。',
      '旅遊 eSIM 多為數據服務，不應預設包含台灣電話號碼、語音或簡訊；需要收驗證碼時要逐項確認。',
      '目前本站上架的台灣 eSIM 方案全部免 KYC、免實名與證件核驗，不需上傳護照或身分證件。',
      '短期吃到飽也可能有高速流量、流量管理或熱點額度；需用筆電工作時要先看分享規則。',
      '純數據旅遊 eSIM 的網路路由可能和台灣本地門號不同，延遲與可用功能以實際商品為準。'
    ],
    faqs: [
      { question: '台灣短期 eSIM 需要綁約或付月租費嗎？', answer: '本站的短期旅遊 eSIM 依商品天數與流量一次選購，不需要申辦月租型門號或綁長約。方案到期後即停止使用；是否能加購或延長則依商品規則。' },
      { question: '人在台灣臨時需要網路，可以馬上購買 eSIM 嗎？', answer: '可以先確認手機支援 eSIM、沒有電信商鎖定，並且目前有穩定 Wi-Fi 可接收及安裝資料。付款、交付與啟用時間仍依商品頁及訂單狀態為準，緊急需求應預留設定時間。' },
      { question: '返台幾天也適合使用台灣 eSIM 嗎？', answer: '適合。若原本沒有台灣門號、原門號暫停、只想增加數據或需要第二條備用網路，可依返台天數選擇短期方案。' },
      { question: '台灣 eSIM 有本地電話號碼，可以收簡訊嗎？', answer: '不一定。許多旅遊 eSIM 是數據型，不含本地門號、語音與簡訊。若銀行、叫車或服務登入需要台灣號碼，購買前必須確認商品明確提供。' },
      { question: '台灣 eSIM 需要身分驗證嗎？', answer: '目前本站上架的台灣 eSIM 方案皆免 KYC、免實名與證件核驗，不需要上傳護照或身分證件。' }
    ],
    sources: [
      { label: '中華電信：eSIM 數位 SIM 服務與設定', href: 'https://www.cht.com.tw/home/apple/service-offer-description/esim' }
    ]
  },
  {
    slug: 'greater-china-esim',
    destinationSlug: 'greater-china',
    name: '中港澳',
    flag: '🌏',
    priorityRank: null,
    outboundCount: null,
    title: '中港澳 eSIM 怎麼選？中國、香港、澳門跨境網卡完整指南',
    description: '中港澳 eSIM 完整選購指南：比較中國、香港、澳門跨境網卡的涵蓋、共用流量、啟用天數、漫遊路由、常用服務、實名與跨境後設定。',
    keywords: ['中港澳 eSIM 怎麼選', '中港澳 eSIM 推薦', '中港澳網卡', '香港澳門 eSIM', '大灣區 eSIM', '中國香港澳門上網'],
    intro: '同一趟行程會跨越中國、香港與澳門時，多地區 eSIM 可以減少換卡，但必須確認三地都列在商品涵蓋內、流量是否共用，以及中國境內的漫遊路由與常用服務。',
    lightUse: '跨境交通、地圖、LINE、通訊與基本網頁',
    normalUse: '多地導航、社群、照片上傳、叫車與短影音',
    heavyUse: '工作視訊、大檔案、直播或分享熱點',
    cities: ['香港', '澳門', '深圳', '廣州', '珠海'],
    networks: ['各地合作電信網路', '境外漫遊路由'],
    networkAdvice: '跨境後手機會重新搜尋當地合作網路，短暫斷線不一定代表故障。三地可能使用不同電信商，速度與延遲也可能改變；若未自動恢復，可依商品說明切換飛航模式或手動選網。',
    specialHeading: '跨境方案一定要逐項核對',
    specialChecks: [
      '商品涵蓋必須明確列出中國、香港與澳門；相似名稱不等於三地全包。',
      '總量型通常全程共用同一流量池，每日型則需確認重置時區；仍以商品規則為準。',
      '中國境內的常用服務取決於漫遊路由，不能用香港或澳門的連線結果推定。',
      '香港本地發行服務可能涉及實名登記；境外跨境 eSIM 是否需要 KYC 依商品而異。'
    ],
    faqs: [
      { question: '中港澳 eSIM 可以三地共用嗎？', answer: '只有商品明確標示涵蓋中國、香港與澳門時才能三地使用。購買前也要確認流量是全程共用、每日重置或各地分開計算。' },
      { question: '跨境後需要重新安裝 eSIM 嗎？', answer: '通常不需要。手機會搜尋新地區的合作網路；若沒有自動連線，可等待數分鐘、切換飛航模式，再依商品說明選擇網路或檢查 APN。' },
      { question: '中港澳方案在中國一定能使用所有常用 App 嗎？', answer: '不能保證。中國境內可用服務取決於商品的漫遊路由與規則，應逐項查看商品備註，重要工作也應準備替代方案。' }
    ],
    sources: [
      { label: '香港通訊事務管理局：電話智能卡實名登記制', href: 'https://www.ofca.gov.hk/simreg/' },
      { label: 'Apple：在中國大陸透過 iPhone 使用 eSIM', href: 'https://support.apple.com/zh-tw/123879' }
    ]
  }
];

export const RANKED_ESIM_GUIDES = [
  { slug: 'japan-esim', destinationSlug: 'japan', name: '日本', flag: '🇯🇵', priorityRank: 1, outboundCount: 6_730_817 },
  ...ESIM_GUIDES.filter(guide => guide.priorityRank !== null)
].sort((a, b) => (a.priorityRank || Number.MAX_SAFE_INTEGER) - (b.priorityRank || Number.MAX_SAFE_INTEGER));

export function getEsimGuide(slug: string) {
  return ESIM_GUIDES.find(guide => guide.slug === slug) || null;
}

export function getEsimGuideHrefForDestination(destinationSlug: string) {
  if (destinationSlug === 'japan') return '/guides/japan-esim';
  const guide = ESIM_GUIDES.find(item => item.destinationSlug === destinationSlug);
  return guide ? `/guides/${guide.slug}` : null;
}
