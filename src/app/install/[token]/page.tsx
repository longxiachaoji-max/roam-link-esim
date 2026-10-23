import type { Metadata } from 'next';
import Link from 'next/link';
import QRCode from 'qrcode';
import { getServerSupabase } from '@/lib/server-auth';
import { getEsimShareSecret, verifyEsimShareToken } from '@/lib/esim-share-token';
import InstallActions from './install-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'eSIM 安裝｜一飛通全球漫遊 FirstRoamLink',
  description: '掃描 QR Code 或一鍵安裝你的 eSIM。',
  robots: { index: false, follow: false }
};

type Relation<T> = T | T[] | null;
const first = <T,>(value: Relation<T>) => (Array.isArray(value) ? value[0] ?? null : value);

interface SharedItem {
  id: string;
  user_deleted_at: string | null;
  products: Relation<{ name: string; country: string; data_amount: string | null; validity_days: number | null }>;
  e_sim_inventory: Relation<{
    smdp_address: string;
    activation_code: string;
    ios_install_url: string | null;
    android_install_url: string | null;
    expiry_date: string | null;
  }>;
}

async function loadSharedEsim(token: string) {
  const verified = verifyEsimShareToken(token, getEsimShareSecret());
  if (!verified) return null;

  const { data } = await getServerSupabase()
    .from('order_items')
    .select(`
      id,
      user_deleted_at,
      products ( name, country, data_amount, validity_days ),
      e_sim_inventory ( smdp_address, activation_code, ios_install_url, android_install_url, expiry_date )
    `)
    .eq('id', verified.orderItemId)
    .maybeSingle();

  const item = data as SharedItem | null;
  const inventory = first(item?.e_sim_inventory ?? null);
  if (!item || item.user_deleted_at || !inventory?.smdp_address || !inventory.activation_code) return null;
  return { product: first(item.products), inventory };
}

function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-4">
      <Link href="/" className="font-bold leading-tight">
        <span className="block text-[11px] text-white/55">一飛通全球漫遊</span>
        <span className="block text-sm text-[#ff6b73]">FirstRoamLink</span>
      </Link>
      <Link href="/#products" className="rounded-md bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15">eSIM 方案</Link>
    </header>
  );
}

function ShopCta() {
  return (
    <section className="mt-6 rounded-2xl border border-[#ff6b73]/25 bg-gradient-to-br from-[#ff6b73]/15 to-[#f5bd61]/10 p-5 text-center">
      <p className="text-base font-black text-white">下次出國，也用一飛通</p>
      <p className="mt-1 text-sm text-white/60">日本、韓國、泰國等熱門目的地，線上買完馬上安裝。</p>
      <Link
        href="/?utm_source=esim_share&utm_medium=share_link#products"
        className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#ff6b73] to-[#f5bd61] px-6 text-sm font-black text-[#17131a]"
      >
        逛逛其他目的地 eSIM →
      </Link>
    </section>
  );
}

export default async function SharedEsimInstallPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await loadSharedEsim(token);

  if (!shared) {
    return (
      <main className="min-h-[100svh] bg-[#12121f] text-white">
        <SiteHeader />
        <div className="mx-auto max-w-md px-4 pb-10 pt-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
            <p className="text-4xl">🔒</p>
            <h1 className="mt-3 text-xl font-black">這個安裝連結已失效</h1>
            <p className="mt-2 text-sm leading-6 text-white/60">連結可能已過期，或 eSIM 已被移除。請向分享給你的朋友重新取得連結。</p>
          </div>
          <ShopCta />
        </div>
      </main>
    );
  }

  const { product, inventory } = shared;
  const lpa = `LPA:1$${inventory.smdp_address}$${inventory.activation_code}`;
  const qrSvg = await QRCode.toString(lpa, { type: 'svg', margin: 1, width: 240, errorCorrectionLevel: 'M' });
  const iosInstallUrl = inventory.ios_install_url
    || `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(lpa)}`;
  const deadline = inventory.expiry_date
    ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(inventory.expiry_date))
    : null;

  return (
    <main className="min-h-[100svh] bg-[#12121f] text-white">
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 pb-10">
        <section className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-5">
          <p className="text-xs font-bold text-cyan-300">朋友分享給你的 eSIM</p>
          <h1 className="mt-1 text-2xl font-black leading-tight">{product?.name || 'eSIM 安裝'}</h1>
          <p className="mt-2 text-sm text-white/55">
            {[product?.country, product?.data_amount, product?.validity_days ? `${product.validity_days} 天` : null].filter(Boolean).join(' · ')}
          </p>
          {deadline && <p className="mt-1 text-xs text-yellow-200/80">最晚安裝日：{deadline}</p>}

          <div className="mx-auto mt-5 w-[248px] rounded-2xl bg-white p-1" aria-label="eSIM 安裝 QR Code" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="mt-3 text-center text-xs text-white/45">用另一支手機開這頁時，可以直接掃描上面的 QR Code</p>

          <InstallActions
            iosInstallUrl={iosInstallUrl}
            androidInstallUrl={inventory.android_install_url}
            smdpAddress={inventory.smdp_address}
            activationCode={inventory.activation_code}
            lpa={lpa}
          />
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-white/70">
          <h2 className="mb-2 font-black text-white">安裝前請注意</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>安裝時請連上穩定的 Wi-Fi 或行動網路，過程中不要中斷。</li>
            <li>每組 eSIM 只能安裝在一支手機上，安裝後請不要刪除。</li>
            <li>抵達目的地後，到「設定 → 行動網路」開啟這張 eSIM 和「數據漫遊」。</li>
          </ol>
        </section>

        <ShopCta />
      </div>
    </main>
  );
}
