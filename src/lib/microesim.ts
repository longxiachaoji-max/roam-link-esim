import crypto from 'crypto';

const MICROESIM_TEST_PLAN_ID = 'b1a926e1-d770-4e03-804e-c527b9397eb9';
const MICROESIM_PRODUCT_MARKER = 'MicroEsim 測試';

interface MicroesimSubscribeResult {
  topup_id?: string;
}

interface MicroesimTopupDetail {
  topup_id?: string;
  device_ids?: string[];
  lpa_str?: string[];
  qrcode?: string[];
  ios_esim_install_link?: string[];
  android_esim_install_link?: string[];
  channel_dataplan_name?: string;
}

interface MicroesimResponse<T> {
  code: number;
  msg: string;
  result?: T;
}

export interface MicroesimPlan {
  channel_dataplan_id: string;
  channel_dataplan_name: string;
  price: string;
  currency: string;
  status: string;
  day: number;
  data: string;
  apn?: string;
  active_type?: string;
  code?: string;
  networks?: string;
  ip?: string;
  rule_desc?: string;
  validity_period?: string;
  special_desc?: string;
}

interface MicroesimPlanPage {
  pageNo: number;
  pageSize: number;
  total: number;
  totalPages: number;
  list: MicroesimPlan[];
}

export interface TransformedMicroesimPlan {
  supplier: 'microesim';
  supplier_plan_id: string;
  supplier_plan_name: string;
  name: string;
  country: string;
  data_amount: string;
  hotspot_sharing: string;
  validity_days: number;
  price: number;
  cost_original: number;
  cost_currency: string;
  cost_twd: number;
  suggested_price: number;
  margin_twd: number;
  carrier: string;
  networks: string;
  active_type_note: string;
  rule_desc_zh: string;
  special_desc_zh: string;
  customer_note: string;
  internal_warning: string;
  flags: {
    kyc: boolean;
    noReinstall: boolean;
    noHotspot: boolean;
    noGpt: boolean;
    speedLimit: boolean;
    terminateAfterUse: boolean;
  };
  raw: MicroesimPlan;
}

export interface MicroesimInventoryPayload {
  iccid: string | null;
  smdp_address: string;
  activation_code: string;
  raw_lpa: string;
  qr_code_url: string | null;
  topup_id: string;
  cost: number;
}

function getMicroesimConfig() {
  return {
    baseUrl: process.env.MICROESIM_BASE_URL || 'https://test.microesim.com',
    account: process.env.MICROESIM_ACCOUNT || '',
    secret: process.env.MICROESIM_SECRET || '',
    salt: process.env.MICROESIM_SALT || ''
  };
}

function buildHeaders(contentType: string) {
  const { account, secret, salt } = getMicroesimConfig();
  if (!account || !secret || !salt) {
    throw new Error('MicroEsim API 尚未設定');
  }

  const nonce = crypto.randomBytes(10).toString('hex');
  const timestamp = Date.now().toString();
  const derivedKey = crypto.pbkdf2Sync(secret, Buffer.from(salt, 'hex'), 1024, 32, 'sha256').toString('hex');
  const signature = crypto
    .createHmac('sha256', Buffer.from(derivedKey, 'utf8'))
    .update(account + nonce + timestamp)
    .digest('hex');

  return {
    'Content-Type': contentType,
    'MICROESIM-ACCOUNT': account,
    'MICROESIM-NONCE': nonce,
    'MICROESIM-TIMESTAMP': timestamp,
    'MICROESIM-SIGN': signature
  };
}

async function microesimGet<T>(path: string) {
  const { baseUrl } = getMicroesimConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: buildHeaders('application/json'),
    cache: 'no-store'
  });
  const data = await response.json() as MicroesimResponse<T>;

  if (!response.ok || data.code !== 1) {
    throw new Error(`MicroEsim API 失敗：${data.msg || response.statusText}`);
  }

  if (!data.result) {
    throw new Error('MicroEsim API 沒有回傳結果');
  }

  return data.result;
}

async function microesimPost<T>(path: string, body: Record<string, string>) {
  const { baseUrl } = getMicroesimConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: buildHeaders('application/x-www-form-urlencoded'),
    body: new URLSearchParams(body).toString()
  });
  const data = await response.json() as MicroesimResponse<T>;

  if (!response.ok || data.code !== 1) {
    throw new Error(`MicroEsim API 失敗：${data.msg || response.statusText}`);
  }

  if (!data.result) {
    throw new Error('MicroEsim API 沒有回傳結果');
  }

  return data.result;
}

function roundUpToTen(value: number) {
  return Math.ceil(value / 10) * 10;
}

function normalizeText(value?: string | null) {
  return (value || '').trim();
}

function isKoreaPlan(plan: MicroesimPlan) {
  const haystack = [
    plan.code,
    plan.channel_dataplan_name,
    plan.networks
  ].filter(Boolean).join(' ').toLowerCase();

  return /\bkr\b/.test(haystack) || haystack.includes('korea') || haystack.includes('southkorea');
}

function getCarrier(plan: MicroesimPlan) {
  const text = `${plan.channel_dataplan_name} ${plan.networks || ''}`.toLowerCase();
  const carriers: string[] = [];
  if (text.includes('skt') || text.includes('sk telecom')) carriers.push('SKT');
  if (/\bkt\b/.test(text) || text.includes('korea telecom')) carriers.push('KT');
  if (text.includes('lgu') || text.includes('lg u') || text.includes('lg+') || text.includes('lg telecom')) carriers.push('LG U+');
  return carriers.length ? Array.from(new Set(carriers)).join('/') : '';
}

function parseDataLabel(plan: MicroesimPlan) {
  const name = plan.channel_dataplan_name;
  const rawData = normalizeText(plan.data);
  const text = `${name} ${rawData} ${plan.rule_desc || ''}`.replace(/_/g, '-');
  const lower = text.toLowerCase();

  const dailyMatch = text.match(/daily[-\s]?(\d+(?:\.\d+)?)\s*(gb|mb)/i)
    || text.match(/(\d+(?:\.\d+)?)\s*(gb|mb)\s*\/\s*day/i)
    || text.match(/(\d+(?:\.\d+)?)\s*(gb|mb)\s*day/i);
  if (dailyMatch) {
    return {
      dataAmount: `每日${dailyMatch[1]}${dailyMatch[2].toUpperCase()}`,
      nameData: `每日${dailyMatch[1]}${dailyMatch[2].toUpperCase()}`,
      unlimited: false
    };
  }

  const totalMatch = text.match(/total[-\s]?(\d+(?:\.\d+)?)\s*(gb|mb)/i)
    || text.match(/(\d+(?:\.\d+)?)\s*(gb|mb)\s*total/i);
  if (totalMatch) {
    return {
      dataAmount: `總量${totalMatch[1]}${totalMatch[2].toUpperCase()}`,
      nameData: `總量${totalMatch[1]}${totalMatch[2].toUpperCase()}`,
      unlimited: false
    };
  }

  if (lower.includes('unlimited')) {
    const speed = lower.match(/(\d+(?:\.\d+)?)\s*(mbps|kbps|kb)/i);
    const speedText = speed ? `${speed[1]}${speed[2].toLowerCase() === 'kb' ? 'kbps' : speed[2]}` : '';
    return {
      dataAmount: speedText ? `吃到飽，最高速率${speedText}` : '吃到飽',
      nameData: speedText ? `${speedText}吃到飽` : '吃到飽',
      unlimited: true
    };
  }

  const plainSize = text.match(/(\d+(?:\.\d+)?)\s*(gb|mb)/i);
  if (plainSize) {
    return {
      dataAmount: `總量${plainSize[1]}${plainSize[2].toUpperCase()}`,
      nameData: `總量${plainSize[1]}${plainSize[2].toUpperCase()}`,
      unlimited: false
    };
  }

  return {
    dataAmount: rawData || '標準方案',
    nameData: rawData || '標準方案',
    unlimited: lower.includes('unlimited')
  };
}

function translateActiveType(activeType?: string | null) {
  const value = normalizeText(activeType).toUpperCase();
  if (!value) return '';
  if (value.includes('ACTIVEDBYDEVICE')) return '連上當地網路後開始計算效期';
  if (value.includes('ACTIVEDBYINSTALL')) return '安裝後開始計算效期';
  if (value.includes('ACTIVEDBYFIRSTUSE')) return '首次使用後開始計算效期';
  return `啟用方式：${activeType}`;
}

function translateRule(ruleDesc?: string | null) {
  const raw = normalizeText(ruleDesc);
  const lower = raw.toLowerCase();
  if (!raw) return '';
  if (lower.includes('terminate')) return '流量用完即停用';
  if (lower.includes('unlimited')) {
    const speed = raw.match(/(\d+(?:\.\d+)?)\s*(mbps|kbps|kb)/i);
    if (speed) {
      const unit = speed[2].toLowerCase() === 'kb' ? 'kbps' : speed[2];
      return `吃到飽，最高速率 ${speed[1]}${unit}`;
    }
    return '吃到飽方案';
  }
  if (lower.includes('128kb')) return '用畢降速 128kbps';
  return raw;
}

function translateSpecial(specialDesc?: string | null) {
  const raw = normalizeText(specialDesc);
  if (!raw) return { text: '', flags: {
    kyc: false,
    noReinstall: false,
    noHotspot: false,
    noGpt: false
  } };

  const lower = raw.toLowerCase();
  const notes: string[] = [];
  const flags = {
    kyc: /kyc|ekyc|real[\s-]?name|identity|verification/.test(lower),
    noReinstall: /cannot reinstall|can't reinstall|can not reinstall|not reinstall|no reinstall|single install|one[-\s]?time install|不可重/.test(lower),
    noHotspot: /hotspot not|no hotspot|tethering not|no tethering|不可熱點|不支援熱點/.test(lower),
    noGpt: /chatgpt|gpt|openai/.test(lower)
  };

  if (flags.kyc) notes.push('需要實名認證 KYC');
  if (flags.noReinstall) notes.push('不可重複安裝，刪除 eSIM 後無法再次安裝');
  if (flags.noHotspot) notes.push('不支援熱點分享');
  if (flags.noGpt) notes.push('不支援 ChatGPT / GPT 服務');

  const remaining = raw
    .replace(/e?kyc required esim/ig, '')
    .replace(/e?kyc required/ig, '')
    .replace(/cannot reinstall|can not reinstall|no reinstall/ig, '')
    .replace(/chatgpt|gpt|openai/ig, '')
    .replace(/hotspot not supported|no hotspot|no tethering/ig, '')
    .replace(/[;|,，、]\s*$/g, '')
    .trim();

  if (remaining) notes.push(`原備註：${remaining}`);
  return { text: notes.join('｜'), flags };
}

function getHotspotSharing(plan: MicroesimPlan, noHotspot: boolean) {
  if (noHotspot) return '不支援熱點分享';
  const text = `${plan.channel_dataplan_name} ${plan.special_desc || ''}`.toLowerCase();
  const hotspotMatch = text.match(/hotspot[^0-9]*(\d+(?:\.\d+)?)\s*(gb|mb)/i);
  if (hotspotMatch) return `熱點分享${hotspotMatch[1]}${hotspotMatch[2].toUpperCase()}`;
  return '熱點依當地電信規則';
}

function convertCostToTwd(price: number, currency: string, rates: { hkd: number; usd: number }) {
  const upper = currency.toUpperCase();
  if (upper === 'TWD' || upper === 'NTD') return price;
  if (upper === 'USD') return price * rates.usd;
  if (upper === 'HKD') return price * rates.hkd;
  return price;
}

export function transformMicroesimPlan(
  plan: MicroesimPlan,
  options: { hkdRate?: number; usdRate?: number; markup?: number } = {}
): TransformedMicroesimPlan {
  const country = isKoreaPlan(plan) ? '韓國' : normalizeText(plan.code) || '其他';
  const carrier = getCarrier(plan);
  const data = parseDataLabel(plan);
  const activeTypeNote = translateActiveType(plan.active_type);
  const ruleDescZh = translateRule(plan.rule_desc);
  const special = translateSpecial(plan.special_desc);
  const flags = {
    ...special.flags,
    speedLimit: /(\d+(?:\.\d+)?)\s*(mbps|kbps|kb)/i.test(`${plan.rule_desc || ''} ${plan.channel_dataplan_name}`),
    terminateAfterUse: normalizeText(plan.rule_desc).toLowerCase().includes('terminate')
  };
  const hotspot = getHotspotSharing(plan, flags.noHotspot);
  const costOriginal = Number(plan.price || 0);
  const costTwd = Math.ceil(convertCostToTwd(costOriginal, plan.currency || 'HKD', {
    hkd: options.hkdRate || 4.15,
    usd: options.usdRate || 32.5
  }));
  const markup = options.markup || 1.65;
  const suggestedPrice = roundUpToTen(Math.max(costTwd * markup, costTwd + 80));
  const warnings = [
    special.text,
    flags.speedLimit ? ruleDescZh : '',
    flags.terminateAfterUse ? ruleDescZh : '',
    activeTypeNote
  ].filter(Boolean);
  const customerNotes = [
    hotspot,
    special.text,
    !flags.speedLimit && !flags.terminateAfterUse ? ruleDescZh : ''
  ].filter(Boolean);

  return {
    supplier: 'microesim',
    supplier_plan_id: plan.channel_dataplan_id,
    supplier_plan_name: plan.channel_dataplan_name,
    name: `${country}${carrier ? ` ${carrier}` : ''} 高速上網 ${plan.day}天/${data.nameData}`,
    country,
    data_amount: data.dataAmount,
    hotspot_sharing: hotspot,
    validity_days: Number(plan.day || 1),
    price: suggestedPrice,
    cost_original: costOriginal,
    cost_currency: plan.currency || 'HKD',
    cost_twd: costTwd,
    suggested_price: suggestedPrice,
    margin_twd: suggestedPrice - costTwd,
    carrier,
    networks: plan.networks || '',
    active_type_note: activeTypeNote,
    rule_desc_zh: ruleDescZh,
    special_desc_zh: special.text,
    customer_note: Array.from(new Set(customerNotes)).join('｜'),
    internal_warning: Array.from(new Set(warnings)).join('｜'),
    flags,
    raw: plan
  };
}

export async function fetchMicroesimPlanPage(pageNo = 1, pageSize = 500) {
  return microesimGet<MicroesimPlanPage>(`/allesim/v1/esimDataplanListPage?pageNo=${pageNo}&pageSize=${pageSize}`);
}

export async function fetchKoreaMicroesimPlans(options: { hkdRate?: number; usdRate?: number; markup?: number; maxPages?: number } = {}) {
  const firstPage = await fetchMicroesimPlanPage(1, 500);
  const totalPages = Math.min(firstPage.totalPages || 1, options.maxPages || 60);
  const allPlans = [...(firstPage.list || [])];

  const remainingPages = Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => index + 2);
  for (let index = 0; index < remainingPages.length; index += 4) {
    const pageBatch = remainingPages.slice(index, index + 4);
    const results = await Promise.all(pageBatch.map(page => fetchMicroesimPlanPage(page, 500)));
    for (const page of results) {
      allPlans.push(...(page.list || []));
    }
  }

  const koreaPlans = allPlans
    .filter(isKoreaPlan)
    .map(plan => transformMicroesimPlan(plan, options))
    .sort((a, b) => {
      if (a.validity_days !== b.validity_days) return a.validity_days - b.validity_days;
      if (a.data_amount !== b.data_amount) return a.data_amount.localeCompare(b.data_amount, 'zh-Hant');
      return a.cost_twd - b.cost_twd;
    });

  return {
    total: firstPage.total || allPlans.length,
    totalPages: firstPage.totalPages || totalPages,
    scanned: allPlans.length,
    plans: koreaPlans
  };
}

function parseLpa(rawLpa: string) {
  const parts = rawLpa.split('$');
  if (parts.length < 3 || !parts[1] || !parts[2]) {
    throw new Error('MicroEsim LPA 格式不正確');
  }

  return {
    smdp_address: parts[1],
    activation_code: parts.slice(2).join('$')
  };
}

export function isMicroesimTestProduct(productName?: string | null) {
  return Boolean(productName?.includes(MICROESIM_PRODUCT_MARKER));
}

export async function createMicroesimTestInventory(): Promise<MicroesimInventoryPayload> {
  const subscribe = await microesimPost<MicroesimSubscribeResult>('/allesim/v1/esimSubscribe', {
    channel_dataplan_id: MICROESIM_TEST_PLAN_ID,
    number: '1'
  });
  const topupId = subscribe.topup_id;
  if (!topupId) throw new Error('MicroEsim 沒有回傳 topup_id');

  const detail = await microesimPost<MicroesimTopupDetail>('/allesim/v1/topupDetail', {
    topup_id: topupId
  });
  const rawLpa = detail.lpa_str?.[0];
  if (!rawLpa) throw new Error('MicroEsim 尚未回傳 eSIM LPA 資料');

  const parsed = parseLpa(rawLpa);
  return {
    ...parsed,
    raw_lpa: rawLpa,
    topup_id: topupId,
    // MicroEsim sandbox returns the same test ICCID repeatedly, while our
    // inventory table keeps ICCID unique. Store the LPA data for test orders
    // and leave ICCID empty until production credentials return real values.
    iccid: null,
    qr_code_url: detail.qrcode?.[0] || null,
    cost: 0
  };
}
