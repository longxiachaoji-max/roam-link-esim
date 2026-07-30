const SOFT_DELETE_RETENTION_MS = 24 * 60 * 60 * 1000;
const RENTAL_HISTORY_RETENTION_MONTHS = 6;
const TAIPEI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface PhysicalOrderVisibilityItem {
  rental_end_date?: string | null;
}

interface PhysicalOrderVisibilityInput {
  user_deleted_at?: string | null;
  physical_order_items?: PhysicalOrderVisibilityItem[] | null;
}

function parseDateOnly(value: string | null | undefined) {
  const match = String(value || '').match(DATE_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, monthIndex, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== monthIndex
    || parsed.getUTCDate() !== day
  ) return null;

  return { year, monthIndex, day };
}

function addMonthsClamped(value: string, months: number) {
  const parsed = parseDateOnly(value);
  if (!parsed) return null;

  const targetMonthIndex = parsed.monthIndex + months;
  const targetYear = parsed.year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonthIndex + 1, 0)).getUTCDate();
  return Date.UTC(targetYear, normalizedMonthIndex, Math.min(parsed.day, lastDay)) - TAIPEI_UTC_OFFSET_MS;
}

export function getPhysicalOrderDeleteHidesAt(userDeletedAt: string | null | undefined) {
  if (!userDeletedAt) return null;
  const deletedAt = new Date(userDeletedAt).getTime();
  return Number.isFinite(deletedAt) ? deletedAt + SOFT_DELETE_RETENTION_MS : null;
}

export function getPhysicalOrderRentalHistoryExpiresAt(items: PhysicalOrderVisibilityItem[] | null | undefined) {
  const latestRentalEndDate = (items || [])
    .map(item => String(item.rental_end_date || ''))
    .filter(value => parseDateOnly(value) !== null)
    .sort()
    .at(-1);

  return latestRentalEndDate
    ? addMonthsClamped(latestRentalEndDate, RENTAL_HISTORY_RETENTION_MONTHS)
    : null;
}

export function isPhysicalOrderVisibleToMember(order: PhysicalOrderVisibilityInput, now = Date.now()) {
  const deleteHidesAt = getPhysicalOrderDeleteHidesAt(order.user_deleted_at);
  if (deleteHidesAt !== null) return now < deleteHidesAt;

  const rentalHistoryExpiresAt = getPhysicalOrderRentalHistoryExpiresAt(order.physical_order_items);
  return rentalHistoryExpiresAt === null || now < rentalHistoryExpiresAt;
}

export function canMemberDeletePhysicalOrder(orderStatus: string, userDeletedAt?: string | null) {
  return orderStatus === 'COMPLETED' && !userDeletedAt;
}
