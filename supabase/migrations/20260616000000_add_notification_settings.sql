CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  hero_badge TEXT,
  hero_title TEXT,
  hero_subtitle TEXT,
  section_title TEXT,
  usage_guide TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

INSERT INTO site_settings (
  id,
  hero_badge,
  hero_title,
  hero_subtitle,
  section_title,
  usage_guide
)
VALUES (
  'main',
  '一飛通全球漫遊 · 2026 全新上線',
  '隨時隨地，全球無縫連線',
  '無需拔插實體 SIM 卡。掃描 QR Code 即可開通 190+ 國家的高速網路。',
  '熱門目的地',
  ''
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS notify_email_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_notify_email TEXT,
  ADD COLUMN IF NOT EXISTS notify_telegram_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

UPDATE site_settings
SET
  notify_email_enabled = COALESCE(notify_email_enabled, true),
  notify_telegram_enabled = COALESCE(notify_telegram_enabled, false)
WHERE id = 'main';

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read main site settings" ON site_settings;
DROP POLICY IF EXISTS "Service role can manage site settings" ON site_settings;
CREATE POLICY "Service role can manage site settings"
  ON site_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON site_settings FROM anon, authenticated;
GRANT ALL ON site_settings TO service_role;
