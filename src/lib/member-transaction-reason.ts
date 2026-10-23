// 會員中心的儲值紀錄只顯示系統自動產生的說明；後台手動儲值／調整時填寫的備註原因與收款金額不給客戶看

const RECEIVED_AMOUNT_PATTERN = /^\s*\[收款金額:[^\]]*\]\s*/;

// 系統自動寫入的說明（結帳、線上儲值、兌換碼、推薦回饋），其餘一律視為後台備註
const SYSTEM_REASON_PATTERNS = [
  /^購買 eSIM \(訂單 [^)]+\)$/,
  /^一飛通商城儲值金結帳 \(訂單 [^)]+\)$/,
  /^一飛通(綠界|超商)儲值/,
  /^兌換代碼: \S+$/,
  /^(儲值推薦碼|折扣碼) \S+ (儲值回饋|結帳回饋)$/,
  /^推薦碼 \S+ (儲值推薦回饋|訂單回饋)$/,
  /^遊樂場過關獎勵/
];

export function toMemberTransactionReason(reason: string | null | undefined, amount: number) {
  const text = String(reason || '').replace(RECEIVED_AMOUNT_PATTERN, '').trim();

  if (/^一飛通(綠界|超商)儲值/.test(text)) {
    // 線上儲值：保留付款方式，去掉後台確認標記與內部訂單 ID
    return text.startsWith('一飛通超商儲值') ? '超商代碼儲值' : '線上刷卡儲值';
  }
  if (text && SYSTEM_REASON_PATTERNS.some(pattern => pattern.test(text))) return text;

  return Number(amount) < 0 ? '儲值金調整' : '儲值';
}
