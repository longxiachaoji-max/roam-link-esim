'use client';

import { useState, useEffect } from 'react';

interface SiteSettings {
  hero_badge: string;
  hero_title: string;
  hero_subtitle: string;
  section_title: string;
}

const DEFAULTS: SiteSettings = {
  hero_badge: '一飛通全球漫遊 · 2026 全新上線',
  hero_title: '隨時隨地，全球無縫連線',
  hero_subtitle: '無需拔插實體 SIM 卡。掃描 QR Code 即可開通 190+ 國家的高速網路。',
  section_title: '熱門目的地'
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/admin/settings');
        const json = await res.json();
        if (json.settings) {
          setSettings(json.settings);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '儲存失敗');
      showToast('✅ 設定已儲存');
    } catch (err: any) {
      showToast('❌ ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULTS);
    showToast('🔄 已重置為預設值（尚未儲存）');
  };

  if (loading) {
    return <div className="text-white/50">載入中...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">系統設定</h1>
          <p className="text-sm text-white/40 mt-1">管理首頁顯示的標語與文案</p>
        </div>
      </div>

      {/* Preview Card */}
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a] rounded-xl border border-white/10 p-6 mb-8 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span className="text-xs text-white/40 font-medium">即時預覽</span>
        </div>
        <div className="text-center py-6">
          <div className="inline-block bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            {settings.hero_badge || '標語'}
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
            {settings.hero_title || '主標題'}
          </h2>
          <p className="text-white/50 text-sm max-w-md mx-auto">
            {settings.hero_subtitle || '副標題'}
          </p>
          <div className="mt-6 text-lg font-black text-white/70">
            {settings.section_title || '區塊標題'}
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm space-y-6">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            頂部標語 <span className="text-white/30">(Badge)</span>
          </label>
          <input
            type="text"
            className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30"
            placeholder="例如：一飛通全球漫遊 · 2026 全新上線"
            value={settings.hero_badge}
            onChange={(e) => setSettings({ ...settings, hero_badge: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            主標題 <span className="text-white/30">(Hero Title)</span>
          </label>
          <input
            type="text"
            className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30"
            placeholder="例如：隨時隨地，全球無縫連線"
            value={settings.hero_title}
            onChange={(e) => setSettings({ ...settings, hero_title: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            副標題 <span className="text-white/30">(Subtitle)</span>
          </label>
          <textarea
            rows={2}
            className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30 resize-none"
            placeholder="例如：無需拔插實體 SIM 卡。掃描 QR Code 即可開通 190+ 國家的高速網路。"
            value={settings.hero_subtitle}
            onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            商品區塊標題 <span className="text-white/30">(Section Title)</span>
          </label>
          <input
            type="text"
            className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30"
            placeholder="例如：熱門目的地"
            value={settings.section_title}
            onChange={(e) => setSettings({ ...settings, section_title: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-white/20 rounded-lg text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            重置為預設值
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              isSaving
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'
            }`}
          >
            {isSaving ? '儲存中...' : '💾 儲存設定'}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full font-bold shadow-2xl z-[300] animate-fade-in-up text-sm whitespace-nowrap">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
