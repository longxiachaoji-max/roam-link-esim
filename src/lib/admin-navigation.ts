export type AdminNavigationItem = {
  id: string;
  name: string;
  href: string;
};

export type AdminNavigationCategory = {
  id: string;
  name: string;
  itemIds: string[];
};

export type AdminNavigationConfig = {
  categories: AdminNavigationCategory[];
};

export const ADMIN_NAVIGATION_ITEMS: AdminNavigationItem[] = [
  { id: 'dashboard', name: '儀表板', href: '/admin' },
  { id: 'customers', name: '會員管理', href: '/admin/customers' },
  { id: 'dealers', name: '經銷商專區', href: '/admin/dealers' },
  { id: 'topup-history', name: '儲值紀錄', href: '/admin/topup-history' },
  { id: 'barcode-orders', name: '超商付款訂單', href: '/admin/barcode-orders' },
  { id: 'analytics', name: '流量統計', href: '/admin/analytics' },
  { id: 'resource-monitor', name: '資源監控', href: '/admin/resource-monitor' },
  { id: 'orders', name: '訂單管理', href: '/admin/orders' },
  { id: 'reviews', name: '商品評論', href: '/admin/reviews' },
  { id: 'products', name: '商品管理', href: '/admin/products' },
  { id: 'physical-products', name: '實體商品管理', href: '/admin/physical-products' },
  { id: 'physical-orders', name: '實體商品訂單', href: '/admin/physical-orders' },
  { id: 'microesim-plans', name: 'MicroEsim 方案庫', href: '/admin/microesim-plans' },
  { id: 'esim-inventory', name: 'eSIM 庫存', href: '/admin/esim-inventory' },
  { id: 'supplier-topups', name: '廠商儲值紀錄', href: '/admin/supplier-topups' },
  { id: 'promo-codes', name: '優惠代碼', href: '/admin/promo-codes' },
  { id: 'payment-limits', name: '付款限制', href: '/admin/payment-limits' },
  { id: 'notifications', name: '訂單提醒設定', href: '/admin/notifications' },
  { id: 'contact', name: '聯絡資訊設定', href: '/admin/contact' },
  { id: 'admin-users', name: '後台人員', href: '/admin/admin-users' },
  { id: 'settings', name: '前台設定', href: '/admin/settings' }
];

export const DEFAULT_ADMIN_NAVIGATION: AdminNavigationConfig = {
  categories: [
    {
      id: 'overview',
      name: '總覽',
      itemIds: ['dashboard', 'analytics', 'resource-monitor']
    },
    {
      id: 'members',
      name: '會員與經銷',
      itemIds: ['customers', 'dealers', 'topup-history', 'promo-codes']
    },
    {
      id: 'orders',
      name: '訂單與服務',
      itemIds: ['orders', 'barcode-orders', 'physical-orders', 'reviews']
    },
    {
      id: 'catalog',
      name: '商品與庫存',
      itemIds: ['products', 'physical-products', 'microesim-plans', 'esim-inventory', 'supplier-topups']
    },
    {
      id: 'system',
      name: '系統設定',
      itemIds: ['payment-limits', 'notifications', 'contact', 'admin-users', 'settings']
    }
  ]
};

const CONFIG_PATTERN = /\n?<!--ADMIN_NAVIGATION_CONFIG:([\s\S]*?)-->\n?/;

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(item => String(item || '').trim()).filter(Boolean)));
}

export function normalizeAdminNavigation(value: unknown): AdminNavigationConfig {
  const validItemIds = new Set(ADMIN_NAVIGATION_ITEMS.map(item => item.id));
  const rawCategories = value && typeof value === 'object' && Array.isArray((value as AdminNavigationConfig).categories)
    ? (value as AdminNavigationConfig).categories
    : [];
  const usedCategoryIds = new Set<string>();
  const usedItemIds = new Set<string>();

  const categories = rawCategories.flatMap((category, index) => {
    const rawId = String(category?.id || '').trim();
    const id = rawId && !usedCategoryIds.has(rawId) ? rawId : `category-${index + 1}`;
    if (usedCategoryIds.has(id)) return [];
    usedCategoryIds.add(id);

    const itemIds = uniqueStrings(category?.itemIds).filter(itemId => {
      if (!validItemIds.has(itemId) || usedItemIds.has(itemId)) return false;
      usedItemIds.add(itemId);
      return true;
    });

    return [{
      id,
      name: String(category?.name || '').trim().slice(0, 30) || `分類 ${index + 1}`,
      itemIds
    }];
  });

  if (categories.length === 0) {
    return structuredClone(DEFAULT_ADMIN_NAVIGATION);
  }

  for (const item of ADMIN_NAVIGATION_ITEMS) {
    if (!usedItemIds.has(item.id)) categories[categories.length - 1].itemIds.push(item.id);
  }

  return { categories };
}

export function parseAdminNavigation(usageGuide: string | null | undefined) {
  const match = (usageGuide || '').match(CONFIG_PATTERN);
  if (!match?.[1]) return structuredClone(DEFAULT_ADMIN_NAVIGATION);

  try {
    return normalizeAdminNavigation(JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')));
  } catch {
    return structuredClone(DEFAULT_ADMIN_NAVIGATION);
  }
}

export function withAdminNavigation(usageGuide: string | null | undefined, config: AdminNavigationConfig) {
  const cleanGuide = (usageGuide || '').replace(CONFIG_PATTERN, '').trim();
  const encoded = Buffer.from(JSON.stringify(normalizeAdminNavigation(config)), 'utf8').toString('base64');
  return `${cleanGuide}${cleanGuide ? '\n\n' : ''}<!--ADMIN_NAVIGATION_CONFIG:${encoded}-->`;
}
