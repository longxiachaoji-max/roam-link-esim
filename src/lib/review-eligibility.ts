// eSIM 評價資格：有實際用量（已啟用／已到期／用量大於 0），或後台按「允許評價」，才能留下評價。
// 已經留過的評價永遠可以查看與修改。

export const LINE_SUPPORT_URL = 'https://lin.ee/Td0EgHE';

interface UsageLike {
  status?: string | null;
  usedData?: string | null;
  activatedAt?: string | null;
}

export function hasEsimUsage(usage: UsageLike | null | undefined) {
  if (!usage) return false;
  if (usage.activatedAt) return true;
  if (usage.status === '已啟用' || usage.status === '已到期') return true;
  const used = Number.parseFloat(String(usage.usedData ?? '').replace(/,/g, ''));
  return Number.isFinite(used) && used > 0;
}

export function canReviewEsim(input: {
  hasExistingReview: boolean;
  reviewUnlockedAt: string | null | undefined;
  usage: UsageLike | null | undefined;
}) {
  return input.hasExistingReview || Boolean(input.reviewUnlockedAt) || hasEsimUsage(input.usage);
}
