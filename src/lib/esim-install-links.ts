// eSIM 安裝連結：iPhone 一鍵安裝、Android 系統安裝、EasyEUICC（實體可插拔 eSIM 卡）

export const EASYEUICC_PACKAGE = 'im.angry.easyeuicc';
// 一飛通自用 Android App（內建 EasyEUICC 修改版，可用 USB 讀卡機寫入實體 eSIM 卡）
export const FIRSTROAMLINK_APP_PACKAGE = 'space.firstesim.app';
export const EASYEUICC_DOWNLOAD_URL = 'https://easyeuicc.org';
// 一飛通 App 內建的讀卡機管理畫面（原 EasyEUICC 主畫面），只在 App 內有效
export const FIRSTROAMLINK_READER_URL = `intent://open#Intent;scheme=firstesim-reader;package=${FIRSTROAMLINK_APP_PACKAGE};end`;

export function buildLpaString(smdpAddress: string, activationCode: string) {
  return `LPA:1$${smdpAddress}$${activationCode}`;
}

export function buildIosInstallUrl(lpa: string, storedUrl?: string | null) {
  return storedUrl || `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(lpa)}`;
}

// EasyEUICC 的 DeepLinkConfirmationActivity 接受 "LPA:1$..." 連結（ACTION_VIEW + BROWSABLE）。
// 用 Android intent 連結指定 EasyEUICC，沒安裝時導到下載頁。
// 在一飛通 App 裡找不到讀卡機畫面時，不要跳去 EasyEUICC 官網，留在管理頁並提示更新 App。
export const FIRSTROAMLINK_READER_MISSING_URL = 'https://firstesim.space/app?reader=missing';

// 一飛通 App 安裝完成後會用「國家＋安裝日期」當預設名稱（例如：台灣1123），國家由這個 extra 帶入
export const FIRSTROAMLINK_NAME_PREFIX_EXTRA = 'firstroamlink_name_prefix';

// 一飛通 App 安裝前會比對卡片內是否已經有這張 eSIM（防止重複安裝）
export const FIRSTROAMLINK_EXPECTED_ICCID_EXTRA = 'firstroamlink_expected_iccid';

// 卡片備註：有備註時，一飛通 App 安裝完成後用備註當預設名稱
export const FIRSTROAMLINK_NOTE_EXTRA = 'firstroamlink_note';

export function buildEasyEuiccIntentUrl(lpa: string, targetPackage: string = EASYEUICC_PACKAGE, namePrefix?: string | null, iccid?: string | null, note?: string | null) {
  const data = lpa.replace(/^LPA:/i, '');
  const isOurApp = targetPackage === FIRSTROAMLINK_APP_PACKAGE;
  const fallback = isOurApp ? FIRSTROAMLINK_READER_MISSING_URL : EASYEUICC_DOWNLOAD_URL;
  const prefix = isOurApp ? String(namePrefix || '').replace(/\s+/g, '').slice(0, 20) : '';
  const prefixExtra = prefix ? `S.${FIRSTROAMLINK_NAME_PREFIX_EXTRA}=${encodeURIComponent(prefix)};` : '';
  const iccidDigits = isOurApp ? String(iccid || '').replace(/[^0-9A-Fa-f]/g, '').slice(0, 22) : '';
  const iccidExtra = iccidDigits ? `S.${FIRSTROAMLINK_EXPECTED_ICCID_EXTRA}=${iccidDigits};` : '';
  // eSIM 名稱上限 64 bytes（中文約 21 字），; 與 # 會破壞 intent 格式
  const noteText = isOurApp ? String(note || '').replace(/[;#\r\n]/g, ' ').trim().slice(0, 20) : '';
  const noteExtra = noteText ? `S.${FIRSTROAMLINK_NOTE_EXTRA}=${encodeURIComponent(noteText)};` : '';
  return `intent:${data}#Intent;scheme=LPA;package=${targetPackage};${prefixExtra}${iccidExtra}${noteExtra}S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}

// 判斷是否在一飛通 Android App（Trusted Web Activity）裡：
// - 第一次載入的 referrer 是 android-app://space.firstesim.app（重新整理、登入跳轉後可能就沒了）
// - App 啟動網址帶 ?source=app
// - Android 上以獨立視窗（standalone / fullscreen）顯示，代表不是在一般瀏覽器分頁
export interface NativeAppSignals {
  referrer: string;
  remembered: string | null;
  search?: string;
  standalone?: boolean;
  userAgent?: string;
}

export function isInFirstRoamLinkApp({ referrer, remembered, search = '', standalone = false, userAgent = '' }: NativeAppSignals) {
  if (remembered === '1') return true;
  if (referrer.startsWith(`android-app://${FIRSTROAMLINK_APP_PACKAGE}`)) return true;
  if (new URLSearchParams(search).get('source') === 'app') return true;
  return standalone && /Android/i.test(userAgent);
}
