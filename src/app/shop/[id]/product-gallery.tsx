"use client";

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Expand, Package, X } from 'lucide-react';

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const hasMultipleImages = images.length > 1;

  const showPrevious = useCallback(() => setSelectedIndex(index => (index - 1 + images.length) % images.length), [images.length]);
  const showNext = useCallback(() => setSelectedIndex(index => (index + 1) % images.length), [images.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxOpen(false);
      if (event.key === 'ArrowLeft' && hasMultipleImages) showPrevious();
      if (event.key === 'ArrowRight' && hasMultipleImages) showNext();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasMultipleImages, lightboxOpen, showNext, showPrevious]);

  const handleTouchEnd = (clientX: number) => {
    if (touchStartX === null || !hasMultipleImages) return;
    const distance = clientX - touchStartX;
    if (Math.abs(distance) >= 45) {
      if (distance > 0) showPrevious();
      else showNext();
    }
    setTouchStartX(null);
  };

  if (images.length === 0) {
    return <div className="grid aspect-[4/3] place-items-center rounded-md border border-black/8 bg-[#edf0f1]"><Package size={48} className="text-black/15" /></div>;
  }

  return <>
    <div className="overflow-hidden rounded-md border border-black/8 bg-white">
      <button type="button" onClick={() => setLightboxOpen(true)} className="group relative block aspect-[4/3] w-full bg-[#edf0f1]" aria-label={`放大檢視 ${productName}`}>
        <Image src={images[selectedIndex]} alt={`${productName} 商品圖片 ${selectedIndex + 1}`} fill priority={selectedIndex === 0} sizes="(max-width: 1024px) 100vw, 58vw" className="object-contain" />
        <span className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-md bg-white/90 text-[#172028] shadow-md transition-transform group-hover:scale-105" title="放大圖片"><Expand size={18} /></span>
        {hasMultipleImages && <span className="absolute bottom-3 left-3 rounded bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">{selectedIndex + 1} / {images.length}</span>}
      </button>
      {hasMultipleImages && <div className="flex gap-2 overflow-x-auto border-t border-black/8 p-3">
        {images.map((image, index) => <button type="button" key={image} onClick={() => setSelectedIndex(index)} aria-label={`顯示第 ${index + 1} 張商品圖片`} aria-current={selectedIndex === index ? 'true' : undefined} className={`relative aspect-square w-20 shrink-0 overflow-hidden rounded-md border-2 bg-black/5 ${selectedIndex === index ? 'border-[#247253]' : 'border-transparent hover:border-black/20'}`}><Image src={image} alt="" fill sizes="80px" className="object-cover" /></button>)}
      </div>}
    </div>

    {lightboxOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={`${productName} 大圖檢視`} onMouseDown={event => event.target === event.currentTarget && setLightboxOpen(false)} onTouchStart={event => setTouchStartX(event.touches[0]?.clientX ?? null)} onTouchEnd={event => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}>
      <div className="relative h-full w-full">
        <Image src={images[selectedIndex]} alt={`${productName} 商品大圖 ${selectedIndex + 1}`} fill sizes="100vw" className="object-contain" priority />
      </div>
      <button type="button" onClick={() => setLightboxOpen(false)} title="關閉大圖" aria-label="關閉大圖" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-md bg-black/65 text-white hover:bg-black/85"><X size={24} /></button>
      {hasMultipleImages && <>
        <button type="button" onClick={showPrevious} title="上一張" aria-label="上一張圖片" className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-md bg-black/65 text-white hover:bg-black/85 sm:left-6"><ChevronLeft size={28} /></button>
        <button type="button" onClick={showNext} title="下一張" aria-label="下一張圖片" className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-md bg-black/65 text-white hover:bg-black/85 sm:right-6"><ChevronRight size={28} /></button>
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/65 px-3 py-1.5 text-sm font-semibold text-white">{selectedIndex + 1} / {images.length}</span>
      </>}
    </div>}
  </>;
}
