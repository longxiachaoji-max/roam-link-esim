import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Package } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getPhysicalStoreAdmin, normalizePhysicalProduct, PHYSICAL_PRODUCT_CATEGORIES } from '@/lib/physical-store';
import ProductPurchase from './product-purchase';

async function getProduct(id: string) {
  const { data } = await getPhysicalStoreAdmin().from('physical_products').select('*').eq('id', id).eq('is_active', true).maybeSingle();
  return data ? normalizePhysicalProduct(data) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: '找不到商品' };
  return {
    title: `${product.name}｜一飛通旅行選物`,
    description: product.summary || product.description?.slice(0, 150) || '一飛通全球漫遊實體旅行商品',
    alternates: { canonical: `/shop/${product.id}` },
    openGraph: { images: product.images[0] ? [product.images[0]] : ['/icon.png'] }
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  const categoryLabel = PHYSICAL_PRODUCT_CATEGORIES[product.category];
  const structuredData = {
    '@context': 'https://schema.org', '@type': 'Product', name: product.name,
    description: product.summary || product.description || '', image: product.images,
    offers: { '@type': 'Offer', priceCurrency: 'TWD', price: product.price, availability: product.stock_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: `https://firstesim.space/shop/${product.id}` }
  };

  return <main className="min-h-screen bg-[#f5f7f8] text-[#172028]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <header className="border-b border-black/8 bg-white"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6"><Link href="/shop" className="text-lg font-bold">FirstRoamLink <span className="text-[#df4d5f]">Travel Shop</span></Link><Link href="/" className="text-sm text-black/50 hover:text-black">eSIM 方案</Link></div></header>
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10"><Link href="/shop" className="mb-6 inline-flex items-center gap-2 text-sm text-black/50 hover:text-black"><ArrowLeft size={16} /> 返回實體商城</Link>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <div className="overflow-hidden rounded-md border border-black/8 bg-white"><div className="relative aspect-[4/3] bg-[#edf0f1]">{product.images[0] ? <Image src={product.images[0]} alt={product.name} fill priority sizes="(max-width: 1024px) 100vw, 58vw" className="object-contain" /> : <div className="grid h-full place-items-center"><Package size={48} className="text-black/15" /></div>}</div>{product.images.length > 1 && <div className="grid grid-cols-4 gap-2 border-t border-black/8 p-3">{product.images.slice(1).map(image => <div key={image} className="relative aspect-square overflow-hidden rounded bg-black/5"><Image src={image} alt="" fill sizes="140px" className="object-cover" /></div>)}</div>}</div>
        <div><p className="mb-3 text-sm font-semibold text-[#247253]">{categoryLabel}</p><h1 className="text-3xl font-bold leading-tight">{product.name}</h1>{product.summary && <p className="mt-4 leading-7 text-black/55">{product.summary}</p>}<ProductPurchase product={product} />
          <div className="mt-8 border-t border-black/10 pt-7"><h2 className="font-bold">商品詳細說明</h2><div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-black/60">{product.description || '商品規格整理中，如需確認請聯絡客服。'}</div></div>{product.category === 'rental' && product.rental_terms && <div className="mt-7 border-t border-black/10 pt-7"><h2 className="font-bold">租借與歸還</h2><div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-black/60">{product.rental_terms}</div></div>}
        </div>
      </div>
    </div>
  </main>;
}
