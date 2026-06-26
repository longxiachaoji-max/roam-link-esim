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
    iccid: detail.device_ids?.[0] || null,
    qr_code_url: detail.qrcode?.[0] || null,
    cost: 0
  };
}
