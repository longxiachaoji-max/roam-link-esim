function normalize(value: string) {
  return value.normalize('NFKC').toUpperCase();
}

function compact(value: string) {
  return normalize(value).replace(/[^A-Z0-9]/g, '');
}

export function getBarcodeAmount(barcode3: string | null | undefined) {
  const normalized = compact(barcode3 || '');
  if (normalized.length < 9) return null;
  const encodedAmount = normalized.slice(-9);
  if (!/^\d{9}$/.test(encodedAmount)) return null;
  return Number(encodedAmount);
}

export function analyzeReceiptText(text: string, options: {
  barcode2?: string | null;
  amount: number;
}) {
  const normalizedText = normalize(text);
  const compactText = compact(text);
  const expectedBarcode2 = compact(options.barcode2 || '');
  const amount = Math.round(Number(options.amount));
  const numericTokens = normalizedText.match(/\d[\d,.]*/g) || [];
  const amountMatched = Number.isInteger(amount) && amount >= 0 && numericTokens.some(token => {
    const integerDigits = token.split('.')[0].replace(/[^\d]/g, '');
    if (!integerDigits || integerDigits.length > 7) return false;
    const parsed = Number(token.replace(/,/g, ''));
    return Number.isFinite(parsed) && parsed === amount;
  });

  return {
    barcode2Matched: expectedBarcode2.length >= 8 && compactText.includes(expectedBarcode2),
    amountMatched,
    normalizedText
  };
}
