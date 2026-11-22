// eSIM 晶片 EID：32 位數字、89 開頭，整串數字 mod 97 = 1（GSMA SGP.29 檢查碼）
export function normalizeEid(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

export function isValidEid(value: unknown) {
  const eid = normalizeEid(value);
  if (!/^89\d{30}$/.test(eid)) return false;
  return BigInt(eid) % BigInt(97) === BigInt(1);
}

/** 從掃描到的文字（條碼、QR、含前綴的字串）找出第一個合法 EID */
export function extractEid(text: unknown) {
  const raw = String(text ?? '');
  for (const match of raw.match(/\d[\d\s-]{30,}\d/g) || []) {
    const digits = normalizeEid(match);
    for (let start = 0; start + 32 <= digits.length; start++) {
      const candidate = digits.slice(start, start + 32);
      if (isValidEid(candidate)) return candidate;
    }
  }
  return null;
}

export function formatEid(value: unknown) {
  return normalizeEid(value).replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function shortEid(value: unknown) {
  const eid = normalizeEid(value);
  return eid ? `…${eid.slice(-6)}` : '';
}
