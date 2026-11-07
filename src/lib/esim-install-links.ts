// eSIM 安裝連結：iPhone 一鍵安裝、Android 系統安裝、EasyEUICC（實體可插拔 eSIM 卡）

export const EASYEUICC_PACKAGE = 'im.angry.easyeuicc';
// 一飛通自用 Android App（內建 EasyEUICC 修改版，可用 USB 讀卡機寫入實體 eSIM 卡）
export const FIRSTROAMLINK_APP_PACKAGE = 'space.firstesim.app';
export const EASYEUICC_DOWNLOAD_URL = 'https://easyeuicc.org';

export function buildLpaString(smdpAddress: string, activationCode: string) {
  return `LPA:1$${smdpAddress}$${activationCode}`;
}

export function buildIosInstallUrl(lpa: string, storedUrl?: string | null) {
  return storedUrl || `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(lpa)}`;
}

// EasyEUICC 的 DeepLinkConfirmationActivity 接受 "LPA:1$..." 連結（ACTION_VIEW + BROWSABLE）。
// 用 Android intent 連結指定 EasyEUICC，沒安裝時導到下載頁。
export function buildEasyEuiccIntentUrl(lpa: string, targetPackage: string = EASYEUICC_PACKAGE) {
  const data = lpa.replace(/^LPA:/i, '');
  return `intent:${data}#Intent;scheme=LPA;package=${targetPackage};S.browser_fallback_url=${encodeURIComponent(EASYEUICC_DOWNLOAD_URL)};end`;
}

// 從一飛通 Android App（Trusted Web Activity）開啟時，第一次載入的 referrer 是 android-app://space.firstesim.app
export function isInFirstRoamLinkApp(referrer: string, remembered: string | null) {
  return remembered === '1' || referrer.startsWith(`android-app://${FIRSTROAMLINK_APP_PACKAGE}`);
}
