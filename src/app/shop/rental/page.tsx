import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Package, Plane, Smartphone } from 'lucide-react';
import { getPhysicalStoreAdmin, normalizePhysicalProduct } from '@/lib/physical-store';
import { serializeJsonLd } from '@/lib/json-ld';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '手機、空拍機與攝影設備租借｜一飛通',
  description: '一飛通租借專區提供旅遊手機、空拍機與攝影配件租借，可查看每日租金、租期優惠、可預約日期與配送方式。',
  keywords: [
    '手機租借',
    '旅遊手機租借',
    '演唱會手機租借',
    '空拍機租借',
    '攝影設備租借',
    '空拍機配件租借',
    '旅遊用品租借'
  ],
  alternates: { canonical: '/shop/rental' },
  openGraph: {
    title: '手機、空拍機與攝影設備租借｜一飛通商城',
    description: '旅遊手機、空拍機與攝影配件租借，查看價格與可預約日期。',
    url: 'https://firstesim.space/shop/rental'
  }
};

async function getRentalProducts() {
  const { data, error } = await getPhysicalStoreAdmin()
    .from('physical_products')
    .select('*')
    .eq('is_active', true)
    .eq('category', 'rental')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Rental landing products failed:', error.message);
    return [];
  }
  return (data || []).map(row => normalizePhysicalProduct(row));
}

const rentalFaqs = [
  {
    question: '手機或空拍機租借天數怎麼計算？',
    answer: '租借頁會依選擇的開始日與結束日計算天數；各商品的每日租金、長租優惠與免運條件請以商品頁顯示為準。'
  },
  {
    question: '旅遊租借商品可以宅配或面交嗎？',
    answer: '結帳時可依目前開放方式選擇宅配或預約面交。面交地點、運費與免運條件會在結帳前顯示。'
  },
  {
    question: '租借日期被預約後還能選嗎？',
    answer: '已被有效訂單預約的日期會無法選取，請改選其他日期或其他租借商品。'
  },
  {
    question: '出國前多久預約租借商品比較好？',
    answer: '建議確認旅程後提早預約，並預留宅配、設備確認及行前測試時間。熱門日期的可租庫存可能較快額滿。'
  }
];

export default async function RentalProductsPage() {
  const products = await getRentalProducts();
  const canonicalUrl = 'https://firstesim.space/shop/rental';
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://firstesim.space/' },
      { '@type': 'ListItem', position: 2, name: '一飛通商城', item: 'https://firstesim.space/shop' },
      { '@type': 'ListItem', position: 3, name: '租借商品專區', item: canonicalUrl }
    ]
  };
  const itemListData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '手機、空拍機與旅遊用品租借',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.name,
        description: product.summary || product.description || '',
        image: product.images,
        category: '旅遊用品租借',
        offers: {
          '@type': 'Offer',
          price: product.price,
          priceCurrency: 'TWD',
          availability: product.stock_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `https://firstesim.space/shop/${product.id}`,
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: product.price,
            priceCurrency: 'TWD',
            unitCode: 'DAY'
          }
        }
      }
    }))
  };
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: rentalFaqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer }
    }))
  };

  return <main className="min-h-screen bg-[#f5f7f8] text-[#172028]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbData) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListData) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqData) }} />

    <header className="border-b border-black/8 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link href="/shop" className="font-bold leading-tight"><span className="block text-xs text-black/55">一飛通全球漫遊</span><span className="block text-base text-[#df4d5f]">FirstRoamLink</span></Link>
        <nav className="flex items-center gap-1 text-sm"><Link href="/shop" className="rounded-md px-3 py-2 text-black/55 hover:bg-black/5">商城</Link><Link href="/esim" className="rounded-md px-3 py-2 text-black/55 hover:bg-black/5">eSIM</Link></nav>
      </div>
    </header>

    <section className="border-b border-black/8 bg-[#dceee7] px-4 py-12 md:px-6 md:py-16">
      <div className="mx-auto max-w-7xl">
        <Link href="/shop" className="inline-flex items-center gap-2 text-sm text-black/50 hover:text-black"><ArrowLeft size={15} />返回一飛通商城</Link>
        <div className="mt-8">
          <p className="text-sm font-bold text-[#247253]">旅遊拍攝設備租借</p>
          <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight md:text-5xl">手機、空拍機與攝影設備租借</h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-black/60 md:text-base">適合自由行拍照、演唱會錄影與旅程空拍，可依需求選擇手機、空拍機及相關攝影配件。實際型號、租金、可預約日期與配送方式，請查看下方最新上架商品。</p>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14" aria-labelledby="rental-products-heading">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 id="rental-products-heading" className="text-2xl font-bold">目前可預約的租借商品</h2><p className="mt-2 text-sm text-black/45">進入商品頁選擇租借日期並查看實際優惠價格。</p></div><span className="inline-flex items-center gap-2 text-sm text-black/45"><CalendarDays size={16} />已預約日期會自動停用</span></div>
      {products.length === 0 ? <div className="mt-8 border-y border-black/8 py-20 text-center text-black/45"><Package className="mx-auto mb-3" size={36} />租借商品準備中</div> : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map(product => <article key={product.id} className="overflow-hidden rounded-md border border-black/8 bg-white shadow-[0_8px_24px_rgba(17,30,38,0.06)]">
          <Link href={`/shop/${product.id}`} className="relative block aspect-[4/3] overflow-hidden bg-[#edf0f1]">{product.images[0] ? <Image src={product.images[0]} alt={`${product.name}租借`} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover transition-transform duration-300 hover:scale-[1.03]" /> : <div className="grid h-full place-items-center"><Package size={36} className="text-black/15" /></div>}</Link>
          <div className="p-4"><p className="text-xs font-semibold text-[#247253]">旅遊用品租借</p><h2 className="mt-2 line-clamp-2 min-h-12 font-bold leading-6"><Link href={`/shop/${product.id}`} className="hover:text-[#df4d5f]">{product.name}</Link></h2><p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-black/45">{product.summary || '查看租借規格、每日價格與可預約日期'}</p><div className="mt-5 flex items-end justify-between"><p><span className="text-xs text-black/35">每日 NT$</span><span className="ml-1 text-xl font-bold text-[#df4d5f]">{product.price.toLocaleString()}</span></p><Link href={`/shop/${product.id}`} title={`查看 ${product.name}`} className="grid h-11 w-11 place-items-center rounded-md bg-[#247253] text-white hover:bg-[#185e42]"><ArrowRight size={18} /></Link></div></div>
        </article>)}
      </div>}
    </section>

    <section className="border-y border-black/8 bg-white px-4 py-11 md:px-6">
      <div className="mx-auto max-w-7xl"><h2 className="text-2xl font-bold">依旅程需求挑選租借設備</h2><div className="mt-7 grid gap-8 md:grid-cols-3">
        <article><Smartphone className="text-[#df4d5f]" size={24} /><h3 className="mt-4 font-bold">旅遊與演唱會手機租借</h3><p className="mt-3 text-sm leading-7 text-black/55">需要望遠拍攝、夜景或錄影設備時，可依上架機型比較商品說明、每日價格與可預約日期，並在使用前完成設備測試。</p></article>
        <article><Plane className="text-[#247253]" size={24} /><h3 className="mt-4 font-bold">空拍機與攝影配件租借</h3><p className="mt-3 text-sm leading-7 text-black/55">空拍機、電池與遙控器等配件會依實際庫存陸續上架。租借前請確認相容設備、目的地飛行規定與攜帶限制。</p></article>
        <article><CheckCircle2 className="text-[#b98a2e]" size={24} /><h3 className="mt-4 font-bold">租期、取件與歸還</h3><p className="mt-3 text-sm leading-7 text-black/55">各商品可設定不同階梯價格與免運條件。選擇日期後系統會顯示租金，宅配或面交方式則以結帳頁當下資訊為準。</p></article>
      </div></div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-11 md:px-6" aria-labelledby="rental-faq-heading">
      <h2 id="rental-faq-heading" className="text-2xl font-bold">手機與空拍機租借常見問題</h2><div className="mt-6 divide-y divide-black/8 border-y border-black/8">{rentalFaqs.map(faq => <article key={faq.question} className="py-5"><h3 className="font-bold">{faq.question}</h3><p className="mt-2 text-sm leading-7 text-black/55">{faq.answer}</p></article>)}</div>
      <div className="mt-9 flex flex-wrap items-center gap-4"><Link href="/shop" className="inline-flex h-11 items-center gap-2 rounded-md bg-[#172028] px-5 text-sm font-bold text-white hover:bg-[#283541]">查看全部出遊商品 <ArrowRight size={16} /></Link><Link href="/esim/japan" className="text-sm font-bold text-[#df4d5f] hover:text-[#b93749]">準備去日本？比較日本網卡</Link></div>
    </section>

    <footer className="border-t border-black/8 bg-white px-4 py-8 text-sm text-black/45 md:px-6"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 sm:flex-row"><span>一飛通全球漫遊 FirstRoamLink</span><div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/company-discount" className="font-semibold hover:text-black">查詢企業優惠</Link><span>旅遊手機、空拍機與出遊用品租借</span></div></div></footer>
  </main>;
}
