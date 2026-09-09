const KYC_NEGATIONS = [
  /免\s*(?:e?kyc|實名(?:認證|驗證)?)/gi,
  /不(?:需要|需)\s*(?:e?kyc|實名(?:認證|驗證)?)/gi,
  /no\s+e?kyc/gi
];

const KYC_REQUIREMENTS = [
  /(?:需要|需)\s*實名(?:認證|驗證)/i,
  /\be?kyc\s+(?:is\s+)?required\b/i,
  /real[\s-]?name\s+(?:is\s+)?required\b/i,
  /identity\s+verification\s+(?:is\s+)?required\b/i
];

export function productRequiresKyc(...values: Array<string | null | undefined>) {
  return values.some(value => {
    let text = String(value || '').trim();
    if (!text) return false;
    for (const pattern of KYC_NEGATIONS) text = text.replace(pattern, '');
    return KYC_REQUIREMENTS.some(pattern => pattern.test(text));
  });
}
