export function buildMicroesimOrderReference(orderNumber: string, orderItemId: string) {
  const normalizedOrderNumber = orderNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18);
  const itemHex = orderItemId.replace(/[^a-fA-F0-9]/g, '').slice(0, 8);
  const itemNumber = Number.parseInt(itemHex || '0', 16) % (36 ** 4);
  const itemSuffix = itemNumber.toString(36).toUpperCase().padStart(4, '0');
  return `${normalizedOrderNumber}${itemSuffix}`.slice(0, 22);
}
