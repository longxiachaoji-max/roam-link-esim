interface EsimPlanSeoOption {
  validityDays: number;
  price: number;
}

interface EsimPlanSeoInput {
  destinationName: string;
  dataAmount: string;
  description: string;
  options: EsimPlanSeoOption[];
}

function compactText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function formatAvailableDays(options: EsimPlanSeoOption[]) {
  const days = [...new Set(options.map(option => option.validityDays).filter(value => value > 0))]
    .sort((a, b) => a - b);

  if (!days.length) return '多種天數';
  if (days.length === 1) return `${days[0]} 天`;
  if (days.length <= 5) return `${days.map(value => `${value} 天`).join('、')}`;
  return `${days[0]} 至 ${days.at(-1)} 天等多種天數`;
}

function trimSeoDescription(value: string, maxLength = 160) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).replace(/[，、；：。\s]+$/u, '')}。`;
}

export function buildEsimPlanSeo({
  destinationName,
  dataAmount,
  description,
  options
}: EsimPlanSeoInput) {
  const destination = compactText(destinationName);
  const specification = compactText(dataAmount) || '行動上網';
  const rawPublicNote = compactText(description);
  const publicNote = rawPublicNote === '熱點依當地電信規則' ? '' : rawPublicNote;
  const availableDays = formatAvailableDays(options);
  const prices = options.map(option => option.price).filter(value => value > 0);
  const lowestPrice = prices.length ? Math.min(...prices) : null;
  const priceText = lowestPrice === null ? '' : `，NT$${lowestPrice.toLocaleString('zh-TW')} 起`;
  const noteText = publicNote ? `。${publicNote.replace(/[。；]+$/u, '')}` : '';
  const descriptionText = trimSeoDescription(
    `${destination} ${specification} eSIM 旅遊上網方案，提供 ${availableDays}${priceText}${noteText}。線上購買後可於會員中心查看安裝資訊。`
  );

  return {
    title: `${destination} ${specification} eSIM｜選擇使用天數`,
    description: descriptionText,
    keywords: [
      `${destination} eSIM`,
      `${destination}網卡`,
      `${destination}旅遊上網`,
      `${destination} ${specification}`,
      `${destination} eSIM ${availableDays}`
    ]
  };
}
