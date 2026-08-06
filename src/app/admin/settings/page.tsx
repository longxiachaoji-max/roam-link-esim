'use client';

import Image from 'next/image';
import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Clock3,
  GripVertical,
  ImagePlus,
  Link2,
  Save,
  Trash2,
  Upload
} from 'lucide-react';
import { adminFetch } from '@/lib/admin-fetch';
import { compressImageForUpload } from '@/lib/client-image-compression';
import {
  MAX_HOME_CAROUSEL_ITEMS,
  type HomeCarouselItem
} from '@/lib/home-carousel-types';

interface SiteSettings {
  hero_badge: string;
  hero_title: string;
  hero_subtitle: string;
  section_title: string;
  usage_guide: string;
  home_carousel: HomeCarouselItem[];
}

const DEFAULTS: SiteSettings = {
  hero_badge: '一飛通全球漫遊 · 2026 全新上線',
  hero_title: '隨時隨地，全球無縫連線',
  hero_subtitle: '無需拔插實體 SIM 卡。掃描 QR Code 即可開通 190+ 國家的高速網路。',
  section_title: '熱門目的地',
  usage_guide: '',
  home_carousel: []
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失敗';
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const activeBanners = useMemo(
    () => settings.home_carousel.filter(item => item.is_active),
    [settings.home_carousel]
  );

  const showToast = (message: string) => {
    setToastMsg(message);
    window.setTimeout(() => setToastMsg(''), 2800);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await adminFetch('/api/admin/settings', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '讀取設定失敗');
        if (result.settings) {
          setSettings({
            ...DEFAULTS,
            ...result.settings,
            home_carousel: Array.isArray(result.settings.home_carousel)
              ? result.settings.home_carousel
              : []
          });
        }
      } catch (error: unknown) {
        showToast(errorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    void fetchSettings();
  }, []);

  const updateBanner = (index: number, patch: Partial<HomeCarouselItem>) => {
    setSettings(current => ({
      ...current,
      home_carousel: current.home_carousel.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      ))
    }));
  };

  const moveBanner = (from: number, to: number) => {
    if (from === to || to < 0 || to >= settings.home_carousel.length) return;
    setSettings(current => {
      const items = [...current.home_carousel];
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return { ...current, home_carousel: items };
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault();
    if (draggedIndex !== null) moveBanner(draggedIndex, targetIndex);
    setDraggedIndex(null);
  };

  const handleBannerUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0 || isUploading) return;

    const remaining = MAX_HOME_CAROUSEL_ITEMS - settings.home_carousel.length;
    if (remaining <= 0) {
      showToast(`輪播最多 ${MAX_HOME_CAROUSEL_ITEMS} 張圖片`);
      return;
    }

    setIsUploading(true);
    try {
      const uploaded: HomeCarouselItem[] = [];
      for (const file of files.slice(0, remaining)) {
        const prepared = await compressImageForUpload(file, 'home-banner');
        const formData = new FormData();
        formData.append('file', prepared.blob, prepared.fileName);
        const response = await adminFetch('/api/admin/settings/banner-upload', {
          method: 'POST',
          body: formData
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '圖片上傳失敗');
        uploaded.push({
          id: crypto.randomUUID(),
          image_url: result.url,
          storage_path: result.path,
          alt_text: file.name.replace(/\.[^.]+$/, '') || '一飛通最新活動',
          link_url: '',
          duration_seconds: 10,
          is_active: true
        });
      }

      setSettings(current => ({
        ...current,
        home_carousel: [...current.home_carousel, ...uploaded]
      }));
      showToast(`已上傳 ${uploaded.length} 張，請按儲存設定`);
    } catch (error: unknown) {
      showToast(errorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const response = await adminFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || '儲存失敗');
      showToast('前台設定已儲存');
    } catch (error: unknown) {
      showToast(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(current => ({ ...DEFAULTS, home_carousel: current.home_carousel }));
    showToast('文字已重置，輪播圖片已保留，尚未儲存');
  };

  if (loading) return <div className="text-white/50">載入中...</div>;

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">前台設定</h1>
          <p className="mt-1 text-sm text-white/45">管理首頁廣告輪播、首頁文字與使用說明</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-600"
        >
          <Save size={17} />
          {isSaving ? '儲存中...' : '儲存設定'}
        </button>
      </div>

      <section className="mb-6 overflow-hidden rounded-md border border-white/10 bg-[#111122]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2 className="font-bold text-white">首頁廣告輪播</h2>
            <p className="mt-1 text-sm text-white/45">最多 8 張，建議 1600 × 900（16:9）；每張圖片可個別設定停留時間，預設 10 秒。</p>
          </div>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-cyan/40 bg-cyan/10 px-4 text-sm font-bold text-cyan hover:bg-cyan/20">
            {isUploading ? <Upload className="animate-pulse" size={17} /> : <ImagePlus size={17} />}
            {isUploading ? '圖片處理中...' : '上傳圖片'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              disabled={isUploading || settings.home_carousel.length >= MAX_HOME_CAROUSEL_ITEMS}
              onChange={handleBannerUpload}
              className="sr-only"
            />
          </label>
        </div>

        <div className="border-b border-white/10 bg-black/20 p-4 sm:p-6">
          {activeBanners[0] ? (
            <div className="relative mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-md border border-white/10 bg-[#080812]">
              <Image
                src={activeBanners[0].image_url}
                alt={activeBanners[0].alt_text}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
              />
              <span className="absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-xs text-white/80">首頁預覽</span>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 inline-block rounded-full border border-yellow-500/30 bg-yellow-500/15 px-4 py-1.5 text-sm font-bold text-yellow-400">
                {settings.hero_badge || '標語'}
              </div>
              <h2 className="mb-3 text-2xl font-black text-white md:text-3xl">{settings.hero_title || '主標題'}</h2>
              <p className="mx-auto max-w-md text-sm text-white/50">{settings.hero_subtitle || '副標題'}</p>
            </div>
          )}
        </div>

        {settings.home_carousel.length === 0 ? (
          <div className="p-8 text-center text-sm text-white/45">尚未上傳廣告圖片，目前首頁會繼續顯示原本的文字。</div>
        ) : (
          <div>
            {settings.home_carousel.map((banner, index) => (
              <div
                key={banner.id}
                draggable
                onDragStart={() => setDraggedIndex(index)}
                onDragOver={event => event.preventDefault()}
                onDrop={event => handleDrop(event, index)}
                onDragEnd={() => setDraggedIndex(null)}
                className={`grid gap-4 border-b border-white/10 p-4 last:border-b-0 md:grid-cols-[32px_150px_1fr_auto] md:items-center ${draggedIndex === index ? 'bg-cyan/5 opacity-60' : ''}`}
              >
                <button type="button" className="hidden cursor-grab text-white/35 md:block" title="拖曳排序">
                  <GripVertical size={20} />
                </button>
                <div className="relative aspect-video overflow-hidden rounded-md bg-black">
                  <Image src={banner.image_url} alt={banner.alt_text} fill sizes="150px" className="object-contain" />
                </div>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-xs text-white/50">
                    圖片說明
                    <input
                      type="text"
                      value={banner.alt_text}
                      maxLength={120}
                      onChange={event => updateBanner(index, { alt_text: event.target.value })}
                      className="h-10 rounded-md border border-white/15 bg-black/30 px-3 text-sm text-white outline-none focus:border-cyan"
                      placeholder="例如：日本 eSIM 夏季優惠"
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-white/50">
                    <span className="inline-flex items-center gap-1"><Link2 size={13} />點擊後前往（選填）</span>
                    <input
                      type="text"
                      value={banner.link_url}
                      maxLength={500}
                      onChange={event => updateBanner(index, { link_url: event.target.value })}
                      className="h-10 rounded-md border border-white/15 bg-black/30 px-3 text-sm text-white outline-none focus:border-cyan"
                      placeholder="例如：/esim/japan"
                    />
                  </label>
                  <label className="grid max-w-40 gap-1 text-xs text-white/50">
                    <span className="inline-flex items-center gap-1"><Clock3 size={13} />停留秒數</span>
                    <input
                      type="number"
                      min={3}
                      max={120}
                      step={1}
                      value={banner.duration_seconds}
                      onChange={event => updateBanner(index, {
                        duration_seconds: Math.min(120, Math.max(3, Number(event.target.value) || 10))
                      })}
                      className="h-10 rounded-md border border-white/15 bg-black/30 px-3 text-sm text-white outline-none focus:border-cyan"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between gap-2 md:flex-col">
                  <label className="inline-flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={banner.is_active}
                      onChange={event => updateBanner(index, { is_active: event.target.checked })}
                      className="h-4 w-4 accent-cyan"
                    />
                    顯示
                  </label>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => moveBanner(index, index - 1)} disabled={index === 0} title="上移" className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/60 hover:bg-white/10 disabled:opacity-20"><ArrowUp size={16} /></button>
                    <button type="button" onClick={() => moveBanner(index, index + 1)} disabled={index === settings.home_carousel.length - 1} title="下移" className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/60 hover:bg-white/10 disabled:opacity-20"><ArrowDown size={16} /></button>
                    <button
                      type="button"
                      onClick={() => setSettings(current => ({ ...current, home_carousel: current.home_carousel.filter((_, itemIndex) => itemIndex !== index) }))}
                      title="移除"
                      className="grid h-9 w-9 place-items-center rounded-md border border-red-400/25 text-red-300 hover:bg-red-400/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-6 rounded-md border border-white/10 bg-white/5 p-5 sm:p-6">
        <div>
          <h2 className="font-bold text-white">首頁文字</h2>
          <p className="mt-1 text-xs text-white/40">沒有啟用輪播圖片時，首頁會顯示這組文字。</p>
        </div>
        <label className="grid gap-2 text-sm font-medium text-white/70">
          頂部標語
          <input type="text" className="rounded-md border border-white/20 bg-black/40 p-3 text-white" value={settings.hero_badge} onChange={event => setSettings({ ...settings, hero_badge: event.target.value })} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-white/70">
          主標題
          <input type="text" className="rounded-md border border-white/20 bg-black/40 p-3 text-white" value={settings.hero_title} onChange={event => setSettings({ ...settings, hero_title: event.target.value })} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-white/70">
          副標題
          <textarea rows={2} className="resize-none rounded-md border border-white/20 bg-black/40 p-3 text-white" value={settings.hero_subtitle} onChange={event => setSettings({ ...settings, hero_subtitle: event.target.value })} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-white/70">
          商品區塊標題
          <input type="text" className="rounded-md border border-white/20 bg-black/40 p-3 text-white" value={settings.section_title} onChange={event => setSettings({ ...settings, section_title: event.target.value })} />
        </label>
      </section>

      <section className="mt-6 space-y-5 rounded-md border border-white/10 bg-white/5 p-5 sm:p-6">
        <label className="grid gap-2 text-sm font-medium text-white/70">
          使用說明
          <span className="text-xs font-normal text-white/35">支援 Markdown：標題、粗體、列表、圖片與連結。</span>
          <textarea
            rows={12}
            className="resize-y rounded-md border border-white/20 bg-black/40 p-3 font-mono text-sm text-white"
            value={settings.usage_guide}
            onChange={event => setSettings({ ...settings, usage_guide: event.target.value })}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <button type="button" onClick={handleReset} className="h-10 rounded-md border border-white/20 px-4 text-sm font-medium text-white/55 hover:bg-white/10 hover:text-white">重置文字</button>
          <button type="button" onClick={handleSave} disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-500 disabled:bg-gray-600"><Save size={17} />{isSaving ? '儲存中...' : '儲存設定'}</button>
        </div>
      </section>

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-6 py-3 text-sm font-bold text-black shadow-2xl">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
