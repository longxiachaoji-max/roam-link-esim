import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Star } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getPhysicalStoreAdmin, normalizePhysicalProduct, PHYSICAL_PRODUCT_CATEGORIES } from '@/lib/physical-store';
import { serializeJsonLd } from '@/lib/json-ld';
import { getPublicPhysicalProductReviews } from '@/lib/physical-product-reviews';
import ProductPurchase from './product-purchase';
import ProductGallery from './product-gallery';

export const revalidate = 3600;

async function getProduct(id: string) {
  const { data } = await getPhysicalStoreAdmin().from('physical_products').select('*').eq('id', id).eq('is_active', true).maybeSingle();
  return data ? normalizePhysicalProduct(data) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: '找不到商品' };
  const categoryLabel = PHYSICAL_PRODUCT_CATEGORIES[product.category];
  const rentalProductName = product.name.includes('租借') ? product.name : `${product.name}租借`;
  const title = product.category === 'rental'
    ? `${rentalProductName}｜一飛通商城`
    : `${product.name}｜一飛通商城`;
  const description = product.summary
    || product.description?.slice(0, 150)
    || `一飛通商城提供${categoryLabel}，查看價格、規格與訂購資訊。`;

  return {
    title,
    description,
    alternates: { canonical: `/shop/${product.id}` },
    keywords: [
      product.name,
      categoryLabel,
      ...(product.category === 'rental' ? [rentalProductName, '旅遊用品租借', '旅行用品租借'] : [])
    ],
    openGraph: {
      title,
      description,
      url: `https://firstesim.space/shop/${product.id}`,
      images: product.images[0] ? [product.images[0]] : ['/icon.png']
    }
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  const reviewSummary = await getPublicPhysicalProductReviews(product.id);
  const categoryLabel = PHYSICAL_PRODUCT_CATEGORIES[product.category];
  const categoryHref = product.category === 'rental' ? '/shop/rental' : '/shop';
  const categoryBackLabel = product.category === 'rental' ? '返回租借商品專區' : '返回一飛通商城';
  const offer = {
    '@type': 'Offer',
    priceCurrency: 'TWD',
    price: product.price,
    availability: product.stock_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    url: `https://firstesim.space/shop/${product.id}`,
    ...(product.category === 'rental' ? {
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: product.price,
        priceCurrency: 'TWD',
        unitCode: 'DAY'
      }
    } : {})
  };
  const structuredData = {
    '@context': 'https://schema.org', '@type': 'Product', name: product.name,
    description: product.summary || product.description || '', image: product.images,
    category: categoryLabel,
    ...(reviewSummary.reviewCount > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Number(reviewSummary.averageRating.toFixed(1)),
        reviewCount: reviewSummary.reviewCount,
        bestRating: 5,
        worstRating: 1
      }
    } : {}),
    offers: offer
  };

  return <main className="min-h-screen bg-[#f5f7f8] text-[#172028]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
    <header className="border-b border-black/8 bg-white"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6"><Link href="/shop" className="font-bold leading-tight"><span className="block text-xs text-black/55">一飛通全球漫遊</span><span className="block text-base text-[#df4d5f]">FirstRoamLink</span></Link><Link href="/" className="text-sm text-black/50 hover:text-black">eSIM 方案</Link></div></header>
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10"><Link href={categoryHref} className="mb-6 inline-flex items-center gap-2 text-sm text-black/50 hover:text-black"><ArrowLeft size={16} /> {categoryBackLabel}</Link>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <ProductGallery images={product.images} productName={product.name} />
        <div><Link href={categoryHref} className="mb-3 inline-block text-sm font-semibold text-[#247253] hover:text-[#174d38]">{categoryLabel}</Link><h1 className="text-3xl font-bold leading-tight">{product.name}</h1>{product.summary && <p className="mt-4 leading-7 text-black/55">{product.summary}</p>}<ProductPurchase product={product} />
          <div className="mt-8 border-t border-black/10 pt-7"><h2 className="font-bold">商品詳細說明</h2><div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-black/60">{product.description || '商品規格整理中，如需確認請聯絡客服。'}</div></div>{product.category === 'rental' && product.rental_terms && <div className="mt-7 border-t border-black/10 pt-7"><h2 className="font-bold">租借與歸還</h2><div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-black/60">{product.rental_terms}</div></div>}
        </div>
      </div>
      {reviewSummary.reviewCount > 0 && <section className="mt-12 border-t border-black/10 py-10" aria-labelledby="physical-reviews-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold text-[#247253]">已購買會員真實回饋</p><h2 id="physical-reviews-heading" className="mt-2 text-2xl font-bold">商品使用評價</h2></div>
          <div className="flex items-center gap-3"><span className="text-3xl font-black text-[#d8891c]">{reviewSummary.averageRating.toFixed(1)}</span><div><div className="flex gap-0.5 text-[#d8891c]">{[1, 2, 3, 4, 5].map(star => <Star key={star} size={16} fill={star <= Math.round(reviewSummary.averageRating) ? 'currentColor' : 'none'} />)}</div><p className="mt-1 text-xs text-black/40">共 {reviewSummary.reviewCount} 則評價</p></div></div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {reviewSummary.reviews.map(review => <article key={review.id} className="rounded-md border border-black/10 bg-white p-4">
            <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-black/55">已購買會員</span><span className="text-xs text-black/35">{new Date(review.createdAt).toLocaleDateString('zh-TW')}</span></div>
            <div className="mt-3 flex gap-0.5 text-[#d8891c]">{[1, 2, 3, 4, 5].map(star => <Star key={star} size={14} fill={star <= review.rating ? 'currentColor' : 'none'} />)}</div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-black/60">{review.comment}</p>
          </article>)}
        </div>
      </section>}
    </div>
  </main>;
}
