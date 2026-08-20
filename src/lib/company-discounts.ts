export interface CompanyDiscountRow {
  code: string;
  company_name: string | null;
  discount_type: 'percent' | 'fixed' | null;
  discount_value: number | string | null;
  max_discount: number | string | null;
  min_order_amount: number | string | null;
  max_uses: number | null;
  used_count: number | null;
  starts_at: string | null;
  expires_at: string | null;
}

export function normalizeCompanyName(value: string) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-TW')
    .replace(/[\s\-_.()（）【】「」,，、]/g, '');
}

export function companyNameMatches(companyName: string, query: string) {
  const normalizedCompany = normalizeCompanyName(companyName);
  const normalizedQuery = normalizeCompanyName(query);
  return normalizedQuery.length >= 2 && (
    normalizedCompany.includes(normalizedQuery) || normalizedQuery.includes(normalizedCompany)
  );
}

export function isCompanyDiscountAvailable(row: CompanyDiscountRow, now = new Date()) {
  const timestamp = now.getTime();
  if (!row.company_name || !row.code || !row.discount_type || Number(row.discount_value || 0) <= 0) return false;
  if (row.starts_at && new Date(row.starts_at).getTime() > timestamp) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() < timestamp) return false;
  return Number(row.used_count || 0) < Number(row.max_uses || 1);
}

export function companyDiscountLabel(row: CompanyDiscountRow) {
  if (row.discount_type === 'fixed') {
    return `折抵 NT$${Math.round(Number(row.discount_value || 0)).toLocaleString('zh-TW')}`;
  }
  const percent = Number(row.discount_value || 0);
  const rate = Math.round((10 - percent / 10) * 100) / 100;
  const cap = Number(row.max_discount || 0) > 0
    ? `，最高折 NT$${Math.round(Number(row.max_discount)).toLocaleString('zh-TW')}`
    : '';
  return `${rate} 折${cap}`;
}
