import { NextResponse } from 'next/server';
import { fetchKoreaMicroesimPlans } from '@/lib/microesim';

export const dynamic = 'force-dynamic';

function getNumberParam(url: URL, key: string, fallback: number) {
  const value = Number(url.searchParams.get(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const country = url.searchParams.get('country') || 'KR';
    if (country !== 'KR') {
      return NextResponse.json({ error: '目前測試版先開放韓國方案' }, { status: 400 });
    }

    const hkdRate = getNumberParam(url, 'hkdRate', 4.15);
    const usdRate = getNumberParam(url, 'usdRate', 32.5);
    const markup = getNumberParam(url, 'markup', 1.65);
    const maxPages = getNumberParam(url, 'maxPages', 60);

    const data = await fetchKoreaMicroesimPlans({ hkdRate, usdRate, markup, maxPages });
    return NextResponse.json({
      ...data,
      rates: { hkdRate, usdRate, markup },
      country: '韓國'
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : '讀取 MicroEsim 方案失敗'
    }, { status: 500 });
  }
}
