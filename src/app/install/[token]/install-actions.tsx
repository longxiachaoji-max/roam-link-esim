'use client';

import { useEffect, useState } from 'react';

interface InstallActionsProps {
  iosInstallUrl: string;
  androidInstallUrl: string | null;
  smdpAddress: string;
  activationCode: string;
  lpa: string;
}

export default function InstallActions({ iosInstallUrl, androidInstallUrl, smdpAddress, activationCode, lpa }: InstallActionsProps) {
  const [isAndroid, setIsAndroid] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    // 依手機系統把對應的一鍵安裝按鈕放在最上面
    const timer = window.setTimeout(() => setIsAndroid(/android/i.test(navigator.userAgent)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      window.prompt('請長按複製', value);
    }
  };

  const iosButton = (
    <a key="ios" href={iosInstallUrl} className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 text-sm font-black text-[#071317]">
      iPhone 一鍵安裝
    </a>
  );
  const androidButton = androidInstallUrl ? (
    <a key="android" href={androidInstallUrl} className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-lime-300 text-sm font-black text-[#071317]">
      Android 一鍵安裝
    </a>
  ) : null;

  return (
    <div className="mt-5 space-y-3">
      {isAndroid ? [androidButton, iosButton] : [iosButton, androidButton]}
      {!androidInstallUrl && (
        <p className="text-center text-xs text-white/45">Android：到「設定 → 網路 → SIM 卡 → 新增 eSIM」，掃描 QR Code 或手動輸入下方資料</p>
      )}
      <p className="text-center text-xs text-white/40">iPhone 一鍵安裝需 iOS 17.4 以上</p>

      <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-3 text-xs">
        <p className="font-bold text-white/70">手動輸入</p>
        {[
          { label: 'SM-DP+ 地址', value: smdpAddress },
          { label: '啟用碼', value: activationCode },
          { label: '完整 LPA', value: lpa }
        ].map(field => (
          <div key={field.label} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-white/40">{field.label}</p>
              <p className="break-all font-mono text-white/85">{field.value}</p>
            </div>
            <button type="button" onClick={() => copy(field.label, field.value)} className="shrink-0 rounded-md bg-white/10 px-3 py-2 font-bold text-white hover:bg-white/15">
              {copied === field.label ? '已複製' : '複製'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
