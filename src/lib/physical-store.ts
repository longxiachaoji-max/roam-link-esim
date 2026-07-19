import { createClient } from '@supabase/supabase-js';

export const PHYSICAL_PRODUCT_CATEGORIES = {
  rental: '商品租借',
  travel_card: '實體漫遊卡',
  other: '其他旅遊商品'
} as const;

export type PhysicalProductCategory = keyof typeof PHYSICAL_PRODUCT_CATEGORIES;

export interface PhysicalProduct {
  id: string;
  name: string;
  category: PhysicalProductCategory;
  summary: string | null;
  description: string | null;
  rental_terms: string | null;
  price: number;
  stock_quantity: number;
  images: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function getPhysicalStoreAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('資料庫服務尚未設定');
  return createClient(url, key);
}

export async function requirePhysicalStoreAdmin(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) throw new Error('請先登入管理員帳號');

  const supabase = getPhysicalStoreAdmin();
  const { data, error } = await supabase.auth.getUser(accessToken);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) throw new Error('管理員登入狀態已過期');

  const allowedEmails = (process.env.ADMIN_EMAILS || 'roamlinktw@gmail.com')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowedEmails.includes(email)) throw new Error('此會員沒有後台管理權限');
  return data.user;
}

export function normalizePhysicalProduct(row: Record<string, unknown>): PhysicalProduct {
  return {
    ...(row as unknown as PhysicalProduct),
    price: Number(row.price || 0),
    stock_quantity: Number(row.stock_quantity || 0),
    sort_order: Number(row.sort_order || 0),
    images: Array.isArray(row.images) ? row.images.filter((value): value is string => typeof value === 'string') : []
  };
}

export async function markPhysicalOrderPaid(orderId: string, amount: number) {
  const supabase = getPhysicalStoreAdmin();
  const { data, error } = await supabase.rpc('mark_physical_order_paid', {
    p_order_id: orderId,
    p_paid_amount: amount
  });
  if (error) throw error;
  if (data === 'NOT_FOUND') throw new Error('找不到實體商品訂單');
  if (data === 'AMOUNT_MISMATCH') throw new Error('實體商品訂單付款金額不符');
  return String(data || 'PROCESSING');
}
