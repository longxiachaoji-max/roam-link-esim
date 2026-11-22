// 同一方案買很多張時，把「A、A、A…」合併成「A × 3」
export function groupProductNames(names: Array<string | null | undefined>, fallback = 'eSIM 商品') {
  const counts = new Map<string, number>();
  for (const raw of names) {
    const name = String(raw || '').trim() || fallback;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].map(([name, quantity]) => ({ name, quantity }));
}

export function summarizeProductNames(names: Array<string | null | undefined>, fallback = 'eSIM 商品') {
  return groupProductNames(names, fallback)
    .map(({ name, quantity }) => quantity > 1 ? `${name} × ${quantity}` : name)
    .join('、');
}
