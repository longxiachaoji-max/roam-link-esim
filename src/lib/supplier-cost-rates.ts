import { getServerSupabase } from '@/lib/server-auth';
import { getHkdPerUsd } from '@/lib/fx-rates';
import { movingAverageCostRate, parseSupplierTopups } from '@/lib/supplier-topups';

// 舊的固定匯率：還沒有廠商儲值紀錄時才使用
export const LEGACY_USD_TWD_RATE = 32.5;
export const LEGACY_HKD_TWD_RATE = 4.15;

// 商品成本換算台幣用的匯率：美金用「廠商儲值紀錄」的移動加權平均成本匯率，
// 港幣再用當日港幣兌美金換算（港幣成本 ÷ 港幣/美金 × 台幣/美金）
export async function getSupplierCostRates() {
  const [{ data }, fx] = await Promise.all([
    getServerSupabase().from('site_settings').select('usage_guide').eq('id', 'main').maybeSingle(),
    getHkdPerUsd()
  ]);
  const costRate = movingAverageCostRate(parseSupplierTopups(data?.usage_guide));
  if (!costRate) {
    return { usdRate: LEGACY_USD_TWD_RATE, hkdRate: LEGACY_HKD_TWD_RATE, source: 'legacy' as const, hkdPerUsd: fx.rate };
  }
  return {
    usdRate: Math.round(costRate * 10000) / 10000,
    hkdRate: Math.round((costRate / fx.rate) * 10000) / 10000,
    source: 'supplier_topups' as const,
    hkdPerUsd: fx.rate
  };
}
