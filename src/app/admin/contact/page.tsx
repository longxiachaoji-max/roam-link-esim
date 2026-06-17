'use client';

import { useEffect, useState } from 'react';

interface ContactInfo {
  contact_title: string;
  contact_email: string;
  contact_phone: string;
  contact_note: string;
}

const DEFAULTS: ContactInfo = {
  contact_title: '聯絡資訊',
  contact_email: 'roamlinktw@gmail.com',
  contact_phone: '',
  contact_note: '如需商品或訂單協助，請透過以下方式與我們聯繫。'
};

export default function ContactSettingsPage() {
  const [settings, setSettings] = useState<ContactInfo>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2600);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/admin/contact');
        const json = await res.json();
        if (json.settings) setSettings(json.settings);
      } catch (err) {
        console.error('Error fetching contact settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/contact', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '儲存失敗');
      showToast('聯絡資訊已儲存');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-white/50">載入中...</div>;
  }

  return (
    <div>
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-semibold text-white">聯絡資訊設定</h1>
        <p className="text-sm text-white/40">這裡會顯示在銷售網頁最底下，可填綠界審核用的 Email 或電話。</p>
      </div>

      <section className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">區塊標題</label>
            <input
              type="text"
              className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30"
              placeholder="聯絡資訊"
              value={settings.contact_title}
              onChange={(e) => setSettings({ ...settings, contact_title: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">客服信箱</label>
            <input
              type="email"
              className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30"
              placeholder="roamlinktw@gmail.com"
              value={settings.contact_email}
              onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">客服電話（選填）</label>
            <input
              type="tel"
              className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30"
              placeholder="例如：0912-345-678"
              value={settings.contact_phone}
              onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">補充文字（選填）</label>
            <input
              type="text"
              className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30"
              placeholder="如需商品或訂單協助，請透過以下方式與我們聯繫。"
              value={settings.contact_note}
              onChange={(e) => setSettings({ ...settings, contact_note: e.target.value })}
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 text-sm font-bold text-white shadow-lg"
        >
          {saving ? '儲存中...' : '儲存聯絡資訊'}
        </button>
      </div>

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full font-bold shadow-2xl z-[300] animate-fade-in-up text-sm whitespace-nowrap">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
