// 後台手動輸入 eSIM 用：解析 LPA 字串或分開填寫的 SM-DP+／啟用碼

export function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

// 接受完整 LPA 字串（LPA:1$SM-DP+$啟用碼），或分開填的 SM-DP+ 與啟用碼
export function parseManualEsimInput(input: {
  lpa?: unknown;
  smdp_address?: unknown;
  activation_code?: unknown;
}) {
  const lpa = cleanText(input.lpa).replace(/\s+/g, '');
  if (lpa) {
    const parts = lpa.replace(/^LPA:/i, '').split('$');
    if (parts[0] !== '1' || !parts[1] || !parts[2]) {
      throw new Error('LPA 格式不正確，應為 LPA:1$SM-DP+地址$啟用碼');
    }
    return { smdp_address: parts[1], activation_code: parts.slice(2).join('$') };
  }

  const smdpAddress = cleanText(input.smdp_address);
  const activationCode = cleanText(input.activation_code);
  if (!smdpAddress || !activationCode) {
    throw new Error('請貼上 LPA 字串，或填寫 SM-DP+ 地址與啟用碼');
  }
  return { smdp_address: smdpAddress, activation_code: activationCode };
}
