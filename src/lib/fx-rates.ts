// 港幣兌美金匯率（MicroEsim 帳戶以港幣計價，後台以美金記帳）。港幣聯繫匯率約 7.75–7.85，查不到時用 7.8。
const FALLBACK_HKD_PER_USD = 7.8;

export async function getHkdPerUsd(): Promise<{ rate: number; live: boolean }> {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 6 * 60 * 60 } });
    const data = await response.json();
    const rate = Number(data?.rates?.HKD);
    if (response.ok && data?.result === 'success' && rate > 7 && rate < 8.5) return { rate, live: true };
  } catch {
    // 使用備用匯率
  }
  return { rate: FALLBACK_HKD_PER_USD, live: false };
}
