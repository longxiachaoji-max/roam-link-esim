export const ESIM_CART_STORAGE_KEY = 'roam-link-cart-v1';
export const ESIM_CART_UPDATED_EVENT = 'firstroamlink:esim-cart-updated';

export interface EsimCartItem {
  id: string;
  uid: number;
  country?: string;
  flag?: string;
  data?: string;
  hotspot_sharing?: string;
  days?: string;
  price?: number;
}

export function readEsimCart(): EsimCartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ESIM_CART_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string') : [];
  } catch {
    return [];
  }
}

export function notifyEsimCartUpdated(cart: EsimCartItem[]) {
  window.dispatchEvent(new CustomEvent(ESIM_CART_UPDATED_EVENT, { detail: { count: cart.length } }));
}
