// 本地網路方案（商品名稱含「本地網路」）直接使用當地電信網路，不需開啟數據漫遊；
// 其他方案都要在手機開啟這張 eSIM 的「數據漫遊」才能上網。
export function requiresDataRoaming(...labels: Array<string | null | undefined>) {
  return !labels.some((label) => typeof label === 'string' && label.includes('本地網路'));
}
