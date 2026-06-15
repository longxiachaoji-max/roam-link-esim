'use client';

import { useEffect, useState } from 'react';

interface NotificationSettings {
  notify_email_enabled: boolean;
  order_notify_email: string;
  notify_telegram_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
}

const DEFAULTS: NotificationSettings = {
  notify_email_enabled: true,
  order_notify_email: '',
  notify_telegram_enabled: false,
  telegram_bot_token: '',
  telegram_chat_id: ''
};

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<'email' | 'telegram' | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2600);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/admin/notifications');
        const json = await res.json();
        if (json.settings) setSettings(json.settings);
      } catch (err) {
        console.error('Error fetching notification settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '儲存失敗');
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : '儲存失敗');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    const ok = await saveSettings();
    if (ok) showToast('設定已儲存');
  };

  const handleTest = async (type: 'email' | 'telegram') => {
    if (testing) return;
    setTesting(type);
    try {
      const saved = await saveSettings();
      if (!saved) return;
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '測試失敗');
      showToast(type === 'email' ? '測試信已送出' : 'Telegram 測試訊息已送出');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '測試失敗');
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return <div className="text-white/50">載入中...</div>;
  }

  return (
    <div>
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-semibold text-white">訂單提醒設定</h1>
        <p className="text-sm text-white/40">設定無庫存待補 eSIM 訂單要通知到哪裡</p>
      </div>

      <div className="space-y-6">
        <section className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">Mail 提醒</h2>
              <p className="text-sm text-white/40 mt-1">當訂單沒有庫存可配發時，寄信提醒你補上 eSIM。</p>
            </div>
            <label className="inline-flex items-center gap-3 text-sm text-white/70">
              <input
                type="checkbox"
                checked={settings.notify_email_enabled}
                onChange={(e) => setSettings({ ...settings, notify_email_enabled: e.target.checked })}
                className="h-5 w-5 rounded border-white/20 bg-black/40 accent-blue-500"
              />
              啟用
            </label>
          </div>

          <label className="block text-sm font-medium text-white/70 mb-2">提醒收件信箱</label>
          <input
            type="email"
            className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30"
            placeholder="例如：your@email.com"
            value={settings.order_notify_email}
            onChange={(e) => setSettings({ ...settings, order_notify_email: e.target.value })}
          />

          <div className="flex justify-end mt-4">
            <button
              onClick={() => handleTest('email')}
              disabled={testing === 'email'}
              className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-sm font-bold text-white/80 hover:bg-white/10 disabled:text-white/30"
            >
              {testing === 'email' ? '寄送中...' : '寄送測試信'}
            </button>
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">Telegram 提醒</h2>
              <p className="text-sm text-white/40 mt-1">填入 Bot Token 和 Chat ID 後，待補 eSIM 訂單會傳 Telegram。</p>
            </div>
            <label className="inline-flex items-center gap-3 text-sm text-white/70">
              <input
                type="checkbox"
                checked={settings.notify_telegram_enabled}
                onChange={(e) => setSettings({ ...settings, notify_telegram_enabled: e.target.checked })}
                className="h-5 w-5 rounded border-white/20 bg-black/40 accent-blue-500"
              />
              啟用
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Bot Token</label>
              <input
                type="password"
                className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30"
                placeholder="例如：123456:ABC..."
                value={settings.telegram_bot_token}
                onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Chat ID</label>
              <input
                type="text"
                className="w-full border-white/20 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-3 border text-white bg-black/40 placeholder:text-white/30"
                placeholder="例如：123456789 或 -100..."
                value={settings.telegram_chat_id}
                onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={() => handleTest('telegram')}
              disabled={testing === 'telegram'}
              className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-sm font-bold text-white/80 hover:bg-white/10 disabled:text-white/30"
            >
              {testing === 'telegram' ? '傳送中...' : '傳送 Telegram 測試'}
            </button>
          </div>
        </section>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 text-sm font-bold text-white shadow-lg"
        >
          {saving ? '儲存中...' : '儲存提醒設定'}
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
