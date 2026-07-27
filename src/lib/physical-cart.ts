export const PHYSICAL_CART_STORAGE_KEY = 'firstroamlink-physical-cart-v1';
export const PHYSICAL_CART_OWNER_KEY = 'firstroamlink-physical-cart-owner-v1';

export interface PhysicalCartSnapshotItem {
  productId: string;
  quantity: number;
  rentalStartDate?: string;
  rentalEndDate?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function itemKey(item: PhysicalCartSnapshotItem) {
  return item.rentalStartDate && item.rentalEndDate
    ? `${item.productId}:${item.rentalStartDate}:${item.rentalEndDate}`
    : item.productId;
}

function normalizeDate(value: unknown) {
  const date = String(value || '').trim();
  return DATE_PATTERN.test(date) ? date : '';
}

export function normalizePhysicalCartSnapshot(value: unknown): PhysicalCartSnapshotItem[] {
  if (!Array.isArray(value)) return [];

  const normalized = new Map<string, PhysicalCartSnapshotItem>();
  for (const rawItem of value.slice(0, 20)) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const item = rawItem as Record<string, unknown>;
    const productId = String(item.productId || item.id || '').trim();
    const quantity = Number(item.quantity);
    if (!UUID_PATTERN.test(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) continue;

    const rentalStartDate = normalizeDate(item.rentalStartDate);
    const rentalEndDate = normalizeDate(item.rentalEndDate);
    if (Boolean(rentalStartDate) !== Boolean(rentalEndDate)) continue;
    if (rentalStartDate && rentalEndDate && rentalEndDate < rentalStartDate) continue;

    const next: PhysicalCartSnapshotItem = {
      productId,
      quantity: rentalStartDate ? 1 : quantity,
      ...(rentalStartDate ? { rentalStartDate, rentalEndDate } : {})
    };
    const key = itemKey(next);
    const previous = normalized.get(key);
    normalized.set(key, previous
      ? { ...next, quantity: Math.max(previous.quantity, next.quantity) }
      : next);
  }

  return [...normalized.values()];
}

export function mergePhysicalCartSnapshots(
  ...snapshots: unknown[]
): PhysicalCartSnapshotItem[] {
  return normalizePhysicalCartSnapshot(
    snapshots.flatMap(snapshot => normalizePhysicalCartSnapshot(snapshot))
  );
}

export function readPhysicalCartSnapshot() {
  if (typeof window === 'undefined') return [];
  try {
    return normalizePhysicalCartSnapshot(
      JSON.parse(window.localStorage.getItem(PHYSICAL_CART_STORAGE_KEY) || '[]')
    );
  } catch {
    window.localStorage.removeItem(PHYSICAL_CART_STORAGE_KEY);
    return [];
  }
}

export function writePhysicalCartSnapshot(items: unknown) {
  if (typeof window === 'undefined') return;
  const normalized = normalizePhysicalCartSnapshot(items);
  if (normalized.length) {
    window.localStorage.setItem(PHYSICAL_CART_STORAGE_KEY, JSON.stringify(normalized));
  } else {
    window.localStorage.removeItem(PHYSICAL_CART_STORAGE_KEY);
  }
}

export function physicalCartSnapshotsEqual(left: unknown, right: unknown) {
  return JSON.stringify(normalizePhysicalCartSnapshot(left))
    === JSON.stringify(normalizePhysicalCartSnapshot(right));
}
