export type DeliveryMethod = 'shipping' | 'pickup';

export interface PhysicalStoreSettings {
  shipping_fee: number;
  free_shipping_enabled: boolean;
  free_shipping_threshold: number;
  rental_free_shipping_enabled: boolean;
  rental_free_shipping_days: number;
  pickup_enabled: boolean;
  pickup_label: string;
  pickup_instructions: string;
}

export const DEFAULT_PHYSICAL_STORE_SETTINGS: PhysicalStoreSettings = {
  shipping_fee: 110,
  free_shipping_enabled: true,
  free_shipping_threshold: 1500,
  rental_free_shipping_enabled: true,
  rental_free_shipping_days: 3,
  pickup_enabled: true,
  pickup_label: '新北板橋面交',
  pickup_instructions: '面交需先預約確認時間'
};

export function normalizePhysicalStoreSettings(value: unknown): PhysicalStoreSettings {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const nonNegativeInteger = (input: unknown, fallback: number) => {
    const number = Number(input);
    return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
  };
  const positiveInteger = (input: unknown, fallback: number) => {
    const number = Number(input);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  };
  return {
    shipping_fee: nonNegativeInteger(row.shipping_fee, DEFAULT_PHYSICAL_STORE_SETTINGS.shipping_fee),
    free_shipping_enabled: typeof row.free_shipping_enabled === 'boolean' ? row.free_shipping_enabled : DEFAULT_PHYSICAL_STORE_SETTINGS.free_shipping_enabled,
    free_shipping_threshold: nonNegativeInteger(row.free_shipping_threshold, DEFAULT_PHYSICAL_STORE_SETTINGS.free_shipping_threshold),
    rental_free_shipping_enabled: typeof row.rental_free_shipping_enabled === 'boolean' ? row.rental_free_shipping_enabled : DEFAULT_PHYSICAL_STORE_SETTINGS.rental_free_shipping_enabled,
    rental_free_shipping_days: positiveInteger(row.rental_free_shipping_days, DEFAULT_PHYSICAL_STORE_SETTINGS.rental_free_shipping_days),
    pickup_enabled: typeof row.pickup_enabled === 'boolean' ? row.pickup_enabled : DEFAULT_PHYSICAL_STORE_SETTINGS.pickup_enabled,
    pickup_label: String(row.pickup_label || DEFAULT_PHYSICAL_STORE_SETTINGS.pickup_label).trim().slice(0, 100),
    pickup_instructions: String(row.pickup_instructions || DEFAULT_PHYSICAL_STORE_SETTINGS.pickup_instructions).trim().slice(0, 300)
  };
}

export function calculatePhysicalShippingFee(
  subtotal: number,
  rentalDays: number[],
  deliveryMethod: DeliveryMethod,
  settings: PhysicalStoreSettings
) {
  if (deliveryMethod === 'pickup') return 0;
  if (settings.free_shipping_enabled && subtotal >= settings.free_shipping_threshold) return 0;
  if (settings.rental_free_shipping_enabled && rentalDays.some(days => days >= settings.rental_free_shipping_days)) return 0;
  return settings.shipping_fee;
}
