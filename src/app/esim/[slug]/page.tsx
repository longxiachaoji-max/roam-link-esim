import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ShoppingBag, Wifi } from 'lucide-react';
import { notFound } from 'next/navigation';
import {
  createAutomaticEsimDestination,
  ESIM_DESTINATIONS,
  getEsimDestination,
  getEsimDestinationHref
} from '@/lib/esim-destinations';
import { getEsimDestinationPlanSummary } from '@/lib/esim-seo-products';
import { serializeJsonLd } from '@/lib/json-ld';

export const revalidate = 3600;

export function generateStaticParams() {
  return ESIM_DESTINATIONS.map(destination => ({ slug: destination.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const destination = getEsimDestination(slug) || createAutomaticEsimDestination(slug);
  if (!destination) return { title: '找不到 eSIM 目的地' };

  return {
    title: destination.title,
    description: destination.description,
    keywords: destination.keywords,
    alternates: { canonical: `/esim/${destination.slug}` },
    openGraph: {
      type: 'website',
      title: destination.title,
      description: destination.description,
      url: `https://firstesim.space/esim/${destination.slug}`,
      siteName: '一飛通全球漫遊 FirstRoamLink'
    }
  };
}

function getPlanHref(destinationSlug: string, productId: string) {
  return `/esim/${encodeURIComponent(destinationSlug)}/plan/${encodeURIComponent(productId)}`;
}

function planStructuredData(destination: NonNullable<ReturnType<typeof getEsimDestination>>, plans: Awaited<ReturnType<typeof getEsimDestinationPlanSummary>>['plans']) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${destination.name} 方案`,
    itemListElement: plans.map((plan, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: `${destination.shortName} ${plan.dataAmount} eSIM`,
        description: plan.description || destination.description,
        category: 'Travel eSIM',
        brand: { '@type': 'Brand', name: '一飛通全球漫遊 FirstRoamLink' },
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'TWD',
          lowPrice: plan.lowestPrice,
          highPrice: plan.highestPrice,
          offerCount: plan.availableDays.length,
          availability: 'https://schema.org/InStock',
          url: `https://firstesim.space${getPlanHref(destination.slug, plan.id)}`
        }
      }
    }))
  };
}

export default async function EsimDestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const curatedDestination = getEsimDestination(slug);
  const destination = curatedDestination || createAutomaticEsimDestination(slug);
  if (!destination) notFound();

  const summary = await getEsimDestinationPlanSummary(destination);
  if (!curatedDestination && summary.planCount === 0) notFound();
  const canonicalUrl = `https://firstesim.space/esim/${destination.slug}`;
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://firstesim.space/' },
      { '@type': 'ListItem', position: 2, name: 'eSIM 方案', item: 'https://firstesim.space/esim' },
      { '@type': 'ListItem', position: 3, name: destination.name, item: canonicalUrl }
    ]
  };
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: destination.faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer }
    }))
  };
  const shopHref = `/?country=${encodeURIComponent(destination.countries[0])}#products`;

  return <main className="min-h-screen bg-[#0D0D1A] text-[#F0F0FF]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbData) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqData) }} />
    {summary.plans.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(planStructuredData(destination, summary.plans)) }} />}

    <header className="border-b border-white/10 bg-[#0D0D1A]/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="font-bold leading-tight">
          <span className="block text-xs text-white/55">一飛通全球漫遊</span>
          <span className="block text-base text-[#ff6b73]">FirstRoamLink</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/esim" className="rounded-md px-3 py-2 text-white/60 hover:bg-white/5 hover:text-white">eSIM 目的地</Link>
          <Link href="/shop" aria-label="一飛通商城" className="grid h-10 w-10 place-items-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"><ShoppingBag size={17} /></Link>
        </nav>
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-4 pb-14 pt-6 md:px-6 md:pb-20">
      <nav className="flex items-center gap-2 text-xs text-white/40" aria-label="麵包屑">
        <Link href="/" className="hover:text-white">首頁</Link><span>/</span>
        <Link href="/esim" className="hover:text-white">eSIM 方案</Link><span>/</span>
        <span className="text-white/65">{destination.shortName}</span>
      </nav>

      <section className="mt-8 border-y border-white/10 py-9 md:py-12">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
          <div>
            <div className="mb-4 text-4xl" aria-hidden="true">{destination.flag}</div>
            <h1 className="max-w-4xl text-3xl font-black leading-tight md:text-5xl">{destination.title}</h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-white/60 md:text-base">{destination.intro}</p>
            <Link href="#plans-heading" className="mt-7 inline-flex h-11 items-center gap-2 rounded-md bg-[#ff5a69] px-5 text-sm font-bold text-white hover:bg-[#ff7180]">查看上架方案與價格 <ArrowRight size={16} /></Link>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 md:grid-cols-1">
            <div className="bg-[#171724] p-4"><dt className="text-xs text-white/40">目前上架</dt><dd className="mt-1 text-xl font-bold">{summary.planCount > 0 ? `${summary.planCount} 款` : '準備中'}</dd></div>
            <div className="bg-[#171724] p-4"><dt className="text-xs text-white/40">方案價格</dt><dd className="mt-1 text-xl font-bold text-[#f5bd61]">{summary.lowestPrice !== null ? `NT$${summary.lowestPrice.toLocaleString()} 起` : '請見首頁'}</dd></div>
          </dl>
        </div>
      </section>

      <section className="py-12" aria-labelledby="plans-heading">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold text-[#56d5ea]">即時讀取上架資料</p><h2 id="plans-heading" className="mt-2 text-2xl font-bold">{destination.name} 方案摘要</h2></div>
          {summary.availableDays.length > 0 && <p className="text-xs text-white/40">可選天數：{summary.availableDays.map(days => `${days} 天`).join('、')}</p>}
        </div>
        {summary.featureLabels.length > 0 && <div className="mt-4 flex flex-wrap gap-2" aria-label="目前方案類型">
          {summary.featureLabels.map(label => <span key={label} className="rounded-md border border-[#56d5ea]/20 bg-[#56d5ea]/5 px-3 py-1.5 text-xs font-semibold text-[#56d5ea]">{label}</span>)}
        </div>}

        {summary.plans.length === 0 ? (
          <div className="mt-7 border-y border-white/10 py-12 text-center text-white/45">目前方案整理中，請回首頁查看最新上架內容。</div>
        ) : (
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary.plans.map(plan => (
              <article key={plan.id} className="group rounded-md border border-white/10 bg-[#181826] p-5 transition-colors hover:border-[#56d5ea]/45">
                <Link href={getPlanHref(destination.slug, plan.id)} className="block">
                  <p className="text-xs font-semibold text-[#56d5ea]">{plan.country}</p>
                  <h3 className="mt-2 font-bold leading-6">{plan.dataAmount}</h3>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-white/50"><CalendarDays size={14} />{plan.availableDays.map(days => `${days} 天`).join('、')}</span>
                    <span className="shrink-0 font-bold text-[#f5bd61]">NT${plan.lowestPrice.toLocaleString()} 起</span>
                  </div>
                  {plan.description && <p className="mt-3 line-clamp-2 text-xs leading-5 text-white/40">{plan.description}</p>}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#56d5ea] group-hover:text-white">查看方案與選擇使用天數 <ArrowRight size={13} /></span>
                </Link>
              </article>
            ))}
          </div>
        )}
        <Link href={shopHref} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#56d5ea] hover:text-white">前往首頁選購全部 {destination.shortName} 方案 <ArrowRight size={15} /></Link>
      </section>

      <section className="border-y border-white/10 py-11">
        <h2 className="text-2xl font-bold">挑選 {destination.name} 的重點</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {destination.highlights.map(highlight => <div key={highlight} className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-[#56d5ea]" size={18} /><p className="text-sm leading-6 text-white/60">{highlight}</p></div>)}
        </div>
      </section>

      {destination.guides && destination.guides.length > 0 && <section className="border-b border-white/10 py-11" aria-labelledby="guide-heading">
        <h2 id="guide-heading" className="text-2xl font-bold">{destination.shortName}旅遊上網選購指南</h2>
        <div className="mt-6 grid gap-7 md:grid-cols-3">
          {destination.guides.map(guide => <article key={guide.title}><h3 className="font-bold text-[#56d5ea]">{guide.title}</h3><p className="mt-3 text-sm leading-7 text-white/55">{guide.body}</p></article>)}
        </div>
      </section>}

      <section className="py-11" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-2xl font-bold">{destination.name} 常見問題</h2>
        <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
          {destination.faqs.map(faq => <article key={faq.question} className="py-5"><h3 className="font-bold">{faq.question}</h3><p className="mt-2 text-sm leading-7 text-white/55">{faq.answer}</p></article>)}
        </div>
      </section>

      <section className="border-t border-white/10 pt-10">
        <h2 className="text-lg font-bold">其他熱門 eSIM 目的地</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {ESIM_DESTINATIONS.filter(item => item.slug !== destination.slug).map(item => <Link key={item.slug} href={getEsimDestinationHref(item)} className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-white/60 hover:border-[#56d5ea]/40 hover:text-[#56d5ea]"><span aria-hidden="true">{item.flag}</span>{item.name}</Link>)}
        </div>
        <Link href="/esim" className="mt-7 inline-flex items-center gap-2 text-sm text-white/45 hover:text-white"><ArrowLeft size={15} />返回 eSIM 目的地總覽</Link>
      </section>
    </div>

    <footer className="border-t border-white/10 px-4 py-8 text-sm text-white/40 md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 sm:flex-row"><span>一飛通全球漫遊 FirstRoamLink</span><span className="inline-flex items-center gap-2"><Wifi size={15} />旅遊上網方案</span></div>
    </footer>
  </main>;
}
