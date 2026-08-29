const COUNTRY_MAP: Record<string, { flag: string; region: string }> = {
  '日本': { flag: '🇯🇵', region: '亞洲' },
  '韓國': { flag: '🇰🇷', region: '亞洲' },
  '泰國': { flag: '🇹🇭', region: '亞洲' },
  '越南': { flag: '🇻🇳', region: '亞洲' },
  '新加坡': { flag: '🇸🇬', region: '亞洲' },
  '馬來西亞': { flag: '🇲🇾', region: '亞洲' },
  '中國': { flag: '🇨🇳', region: '亞洲' },
  '香港': { flag: '🇭🇰', region: '亞洲' },
  '台灣': { flag: '🇹🇼', region: '亞洲' },
  '印度': { flag: '🇮🇳', region: '亞洲' },
  '印尼': { flag: '🇮🇩', region: '亞洲' },
  '菲律賓': { flag: '🇵🇭', region: '亞洲' },
  '柬埔寨': { flag: '🇰🇭', region: '亞洲' },
  '美國': { flag: '🇺🇸', region: '美洲' },
  '加拿大': { flag: '🇨🇦', region: '美洲' },
  '墨西哥': { flag: '🇲🇽', region: '美洲' },
  '巴西': { flag: '🇧🇷', region: '美洲' },
  '法國': { flag: '🇫🇷', region: '歐洲' },
  '英國': { flag: '🇬🇧', region: '歐洲' },
  '德國': { flag: '🇩🇪', region: '歐洲' },
  '義大利': { flag: '🇮🇹', region: '歐洲' },
  '西班牙': { flag: '🇪🇸', region: '歐洲' },
  '荷蘭': { flag: '🇳🇱', region: '歐洲' },
  '瑞士': { flag: '🇨🇭', region: '歐洲' },
  '土耳其': { flag: '🇹🇷', region: '歐洲' },
  '澳洲': { flag: '🇦🇺', region: '大洋洲' },
  '紐西蘭': { flag: '🇳🇿', region: '大洋洲' }
};

export function getEsimCountryInfo(country: string) {
  return COUNTRY_MAP[country] || { flag: '🌍', region: '其他' };
}
