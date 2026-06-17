'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface ContactItem {
  id: string;
  label: string;
  value: string;
  href: string;
}

interface ContactInfo {
  contact_title: string;
  contact_email: string;
  contact_phone: string;
  contact_note: string;
  contact_items: ContactItem[];
}

const DEFAULTS: ContactInfo = {
  contact_title: '聯絡資訊',
  contact_email: 'roamlinktw@gmail.com',
  contact_phone: '',
  contact_note: '如需商品或訂單協助，請透過以下方式與我們聯繫。',
  contact_items: [
    {
      id: 'email',
      label: '客服信箱',
      value: 'roamlinktw@gmail.com',
      href: 'mailto:roamlinktw@gmail.com'
    }
  ]
};

function createContactItem(): ContactItem {
  return {
    id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: '',
    value: '',
    href: ''
  };
}

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

  const updateContactItem = (id: string, patch: Partial<ContactItem>) => {
    setSettings({
      ...settings,
      contact_items: settings.contact_items.map(item => item.id === id ? { ...item, ...patch } : item)
    });
  };

  const addContactItem = () => {
    setSettings({
      ...settings,
      contact_items: [...settings.contact_items, createContactItem()]
    });
  };

  const removeContactItem = (id: string) => {
    setSettings({
      ...settings,
      contact_items: settings.contact_items.filter(item => item.id !== id)
    });
  };

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
        <p className="text-sm text-white/40">這裡會顯示在銷售網頁最底下，可自行新增 Email、電話、LINE、Telegram 或客服時間。</p>
      </div>

      <div className="space-y-6">
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

        <section className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">聯絡方式欄位</h2>
              <p className="text-sm text-white/40 mt-1">標籤和值會顯示在前台；連結可填 mailto:、tel: 或網址，留空則只顯示文字。</p>
            </div>
            <button
              onClick={addContactItem}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white"
            >
              <Plus size={16} />
              新增欄位
            </button>
          </div>

          <div className="space-y-4">
            {settings.contact_items.map((item, index) => (
              <div key={item.id} className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1.4fr_auto] gap-3 bg-black/20 border border-white/10 rounded-xl p-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">標籤</label>
                  <input
                    type="text"
                    className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30"
                    placeholder="例如：客服信箱"
                    value={item.label}
                    onChange={(e) => updateContactItem(item.id, { label: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">顯示內容</label>
                  <input
                    type="text"
                    className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30"
                    placeholder="例如：roamlinktw@gmail.com"
                    value={item.value}
                    onChange={(e) => updateContactItem(item.id, { value: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">點擊連結（選填）</label>
                  <input
                    type="text"
                    className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30"
                    placeholder="mailto:... / tel:... / https://..."
                    value={item.href}
                    onChange={(e) => updateContactItem(item.id, { href: e.target.value })}
                  />
                </div>
                <div className="flex lg:items-end">
                  <button
                    onClick={() => removeContactItem(item.id)}
                    disabled={settings.contact_items.length === 1 && index === 0}
                    className="w-full lg:w-11 h-11 inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/70 hover:bg-red-500/20 hover:text-red-200 disabled:text-white/20 disabled:hover:bg-white/5"
                    title="刪除欄位"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

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
