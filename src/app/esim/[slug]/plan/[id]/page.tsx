import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Globe2, ShoppingCart, Wifi } from 'lucide-react';
import { notFound } from 'next/navigation';
import {
  createAutomaticEsimDestination,
  getEsimDestination,
  getEsimDestinationHref
} from '@/lib/esim-destinations';
import { buildEsimPlanSeo } from '@/lib/esim-plan-seo';
import { getEsimDestinationPlanSummary, getEsimPlanDetail } from '@/lib/esim-seo-products';
import { serializeJsonLd } from '@/lib/json-ld';
import PlanPurchase from './plan-purchase';

export const revalidate = 3600;

interface PlanPageProps {
  params: Promise<{ slug: string; id: string }>;
}

async function loadPlan(params: PlanPageProps['params']) {
  const { slug, id } = await params;
  const destination = getEsimDestination(slug) || createAutomaticEsimDestination(slug);
  if (!destination) return null;
  const plan = await getEsimPlanDetail(id, destination);
  if (!plan) return null;
  return { destination, plan };
}

export async function generateMetadata({ params }: PlanPageProps): Promise<Metadata> {
  const result = await loadPlan(params);
  if (!result) return { title: '找不到 eSIM 方案' };
  const { destination, plan } = result;
  const seo = buildEsimPlanSeo({
    destinationName: destination.shortName,
    dataAmount: plan.dataAmount,
    description: plan.description,
    options: plan.options
  });
  const canonicalPath = `/esim/${encodeURIComponent(destination.slug)}/plan/${encodeURIComponent(plan.canonicalId)}`;

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'website',
      title: seo.title,
      description: seo.description,
      url: `https://firstesim.space${canonicalPath}`,
      siteName: '一飛通全球漫遊 FirstRoamLink'
    }
  };
}

export default async function EsimPlanPage({ params }: PlanPageProps) {
  const result = await loadPlan(params);
  if (!result) notFound();
  const { destination, plan } = result;
  const destinationSummary = await getEsimDestinationPlanSummary(destination);
  const seo = buildEsimPlanSeo({
    destinationName: destination.shortName,
    dataAmount: plan.dataAmount,
    description: plan.description,
    options: plan.options
  });
  const relatedPlans = destinationSummary.plans
    .filter(candidate => candidate.dataAmount !== plan.dataAmount);
  const destinationHref = getEsimDestinationHref(destination);
  const canonicalUrl = `https://firstesim.space/esim/${encodeURIComponent(destination.slug)}/plan/${encodeURIComponent(plan.canonicalId)}`;
  const productData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${destination.shortName} ${plan.dataAmount} eSIM`,
    description: seo.description,
    category: 'Travel eSIM',
    brand: { '@type': 'Brand', name: '一飛通全球漫遊 FirstRoamLink' },
    offers: plan.options.map(option => ({
      '@type': 'Offer',
      name: `${option.validityDays} 天`,
      priceCurrency: 'TWD',
      price: option.price,
      availability: 'https://schema.org/InStock',
      url: canonicalUrl
    }))
  };
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://firstesim.space/' },
      { '@type': 'ListItem', position: 2, name: 'eSIM 方案', item: 'https://firstesim.space/esim' },
      { '@type': 'ListItem', position: 3, name: destination.name, item: `https://firstesim.space${destinationHref}` },
      { '@type': 'ListItem', position: 4, name: plan.dataAmount, item: canonicalUrl }
    ]
  };

  return <main className="min-h-screen bg-[#0D0D1A] text-[#F0F0FF]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(productData) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbData) }} />

    <header className="border-b border-white/10 bg-[#0D0D1A]/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="font-bold leading-tight"><span className="block text-xs text-white/55">一飛通全球漫遊</span><span className="block text-base text-[#ff6b73]">FirstRoamLink</span></Link>
        <Link href="/?cart=open" aria-label="開啟購物車" className="grid h-10 w-10 place-items-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"><ShoppingCart size={18} /></Link>
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-6 md:pb-20">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-white/40" aria-label="麵包屑">
        <Link href="/" className="hover:text-white">首頁</Link><span>/</span>
        <Link href="/esim" className="hover:text-white">eSIM 方案</Link><span>/</span>
        <Link href={destinationHref} className="hover:text-white">{destination.shortName}</Link><span>/</span>
        <span className="text-white/65">{plan.dataAmount}</span>
      </nav>

      <section className="mt-8 grid gap-8 border-y border-white/10 py-10 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
        <div>
          <div className="text-4xl" aria-hidden="true">{destination.flag}</div>
          <p className="mt-5 text-sm font-bold text-[#56d5ea]">{destination.name}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight md:text-5xl">{plan.dataAmount}</h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-white/60 md:text-base">{seo.description}</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="flex gap-3"><Globe2 className="mt-0.5 shrink-0 text-[#56d5ea]" size={18} /><div><p className="text-sm font-bold">適用地區</p><p className="mt-1 text-xs leading-5 text-white/45">{plan.country}</p></div></div>
            <div className="flex gap-3"><Clock3 className="mt-0.5 shrink-0 text-[#56d5ea]" size={18} /><div><p className="text-sm font-bold">使用天數</p><p className="mt-1 text-xs leading-5 text-white/45">{plan.options.map(option => `${option.validityDays} 天`).join('、')}</p></div></div>
            <div className="flex gap-3"><Wifi className="mt-0.5 shrink-0 text-[#56d5ea]" size={18} /><div><p className="text-sm font-bold">安裝方式</p><p className="mt-1 text-xs leading-5 text-white/45">付款後於會員中心查看</p></div></div>
          </div>
        </div>

        <PlanPurchase flag={destination.flag} options={plan.options} />
      </section>

      <section className="py-11" aria-labelledby="details-heading">
        <h2 id="details-heading" className="text-2xl font-bold">方案詳細介紹</h2>
        <div className={`mt-6 grid gap-6 ${plan.description ? 'md:grid-cols-2' : ''}`}>
          {plan.description && <div className="border-t border-white/10 pt-5"><h3 className="font-bold text-[#56d5ea]">方案說明</h3><p className="mt-3 whitespace-pre-line text-sm leading-7 text-white/55">{plan.description}</p></div>}
          <div className="border-t border-white/10 pt-5"><h3 className="font-bold text-[#56d5ea]">購買與安裝提醒</h3><div className="mt-3 space-y-3 text-sm leading-6 text-white/55"><p className="flex gap-2"><CheckCircle2 className="mt-1 shrink-0 text-[#56d5ea]" size={15} />購買前確認手機支援 eSIM，且未受電信商鎖定。</p><p className="flex gap-2"><CheckCircle2 className="mt-1 shrink-0 text-[#56d5ea]" size={15} />請於啟用日前或旅程出發前，在穩定網路環境完成安裝。</p><p className="flex gap-2"><CheckCircle2 className="mt-1 shrink-0 text-[#56d5ea]" size={15} />熱點分享、計日方式與其他限制，以方案說明為準。</p></div></div>
        </div>
      </section>

      {relatedPlans.length > 0 && <section className="border-t border-white/10 py-11" aria-labelledby="related-heading">
        <p className="text-xs font-bold text-[#56d5ea]">同國家方案</p>
        <h2 id="related-heading" className="mt-2 text-2xl font-bold">其他{destination.shortName} eSIM 方案</h2>
        <p className="mt-2 text-sm text-white/40">依不限速吃到飽、限速吃到飽、計日型與計量型排序。</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {relatedPlans.map(candidate => <Link
            key={candidate.id}
            href={`/esim/${encodeURIComponent(destination.slug)}/plan/${encodeURIComponent(candidate.id)}`}
            className="group rounded-md border border-white/10 bg-[#181826] p-4 hover:border-[#56d5ea]/45"
          >
            <h3 className="font-bold leading-6">{candidate.dataAmount}</h3>
            <p className="mt-3 text-xs leading-5 text-white/45">{candidate.availableDays.map(days => `${days} 天`).join('、')}</p>
            <div className="mt-4 flex items-center justify-between gap-3"><span className="font-bold text-[#f5bd61]">NT${candidate.lowestPrice.toLocaleString()} 起</span><ArrowRight className="text-[#56d5ea] group-hover:text-white" size={15} /></div>
          </Link>)}
        </div>
      </section>}

      <Link href={destinationHref} className="inline-flex items-center gap-2 text-sm font-bold text-white/50 hover:text-white"><ArrowLeft size={15} />返回{destination.name}方案</Link>
    </div>
  </main>;
}
