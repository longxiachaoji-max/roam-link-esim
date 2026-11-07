// eSIM 安裝連結：iPhone 一鍵安裝、Android 系統安裝、EasyEUICC（實體可插拔 eSIM 卡）

export const EASYEUICC_PACKAGE = 'im.angry.easyeuicc';
export const EASYEUICC_DOWNLOAD_URL = 'https://easyeuicc.org';

export function buildLpaString(smdpAddress: string, activationCode: string) {
  return `LPA:1$${smdpAddress}$${activationCode}`;
}

export function buildIosInstallUrl(lpa: string, storedUrl?: string | null) {
  return storedUrl || `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(lpa)}`;
}

// EasyEUICC 的 DeepLinkConfirmationActivity 接受 "LPA:1$..." 連結（ACTION_VIEW + BROWSABLE）。
// 用 Android intent 連結指定 EasyEUICC，沒安裝時導到下載頁。
export function buildEasyEuiccIntentUrl(lpa: string) {
  const data = lpa.replace(/^LPA:/i, '');
  return `intent:${data}#Intent;scheme=LPA;package=${EASYEUICC_PACKAGE};S.browser_fallback_url=${encodeURIComponent(EASYEUICC_DOWNLOAD_URL)};end`;
}
