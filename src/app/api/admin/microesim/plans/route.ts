import { NextResponse } from 'next/server';
import { adminApiGuard } from '@/lib/server-auth';
import { fetchMicroesimPlansByCountry, MICROESIM_COUNTRY_OPTIONS, MICROESIM_REGION_OPTION } from '@/lib/microesim';

export const dynamic = 'force-dynamic';

function getNumberParam(url: URL, key: string, fallback: number) {
  const value = Number(url.searchParams.get(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function GET(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const countryCode = (url.searchParams.get('country') || 'KR').toUpperCase();
    const country = countryCode === MICROESIM_REGION_OPTION.code
      ? MICROESIM_REGION_OPTION
      : MICROESIM_COUNTRY_OPTIONS.find(option => option.code === countryCode);
    if (!country) {
      return NextResponse.json({ error: '不支援的國家代碼' }, { status: 400 });
    }

    const hkdRate = getNumberParam(url, 'hkdRate', 4.15);
    const usdRate = getNumberParam(url, 'usdRate', 32.5);
    const markup = getNumberParam(url, 'markup', 1.65);
    const maxPages = getNumberParam(url, 'maxPages', 60);

    const data = await fetchMicroesimPlansByCountry(countryCode, { hkdRate, usdRate, markup, maxPages });
    return NextResponse.json({
      ...data,
      rates: { hkdRate, usdRate, markup },
      country
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : '讀取 MicroEsim 方案失敗'
    }, { status: 500 });
  }
}
