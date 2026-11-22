'use client';

// 指定 eSIM 晶片 EID：手動輸入（電腦）或相機掃描條碼／QR Code（手機）
import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Check, X } from 'lucide-react';
import { extractEid, formatEid, isValidEid, normalizeEid, shortEid } from '@/lib/eid';

const ZXING_WASM_URL = '/vendor/zxing_reader-3.1.7.wasm';
const SCAN_FORMATS = ['code_128', 'qr_code', 'data_matrix', 'pdf417', 'code_39'];

interface Detector { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

// 手機 Chrome / 電腦 Chrome 有內建 BarcodeDetector；iPhone Safari 等沒有就載入 zxing（wasm 放在自己網站）
async function createDetector(): Promise<Detector> {
  const NativeDetector = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (NativeDetector) {
    try {
      const supported = await NativeDetector.getSupportedFormats?.() ?? [];
      const formats = SCAN_FORMATS.filter(f => supported.includes(f));
      if (formats.includes('code_128') || formats.includes('qr_code')) return new NativeDetector({ formats });
    } catch { /* 改用 zxing */ }
  }
  const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? ZXING_WASM_URL : prefix + path) },
  });
  return new BarcodeDetector({ formats: SCAN_FORMATS as never }) as unknown as Detector;
}

export function EidEditor({ initialEid, knownEids, count, saving, onSave, onCancel }: {
  initialEid: string | null;
  knownEids: string[];
  count: number;
  saving: boolean;
  onSave: (eid: string | null) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialEid ? formatEid(initialEid) : '');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanHint, setScanHint] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const digits = normalizeEid(value);
  const valid = isValidEid(digits);
  const showError = digits.length >= 32 && !valid;

  useEffect(() => {
    if (!scanning) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (stopped) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = await createDetector();
        const tick = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2) {
              const results = await detector.detect(video);
              for (const result of results) {
                const eid = extractEid(result.rawValue);
                if (eid) {
                  setValue(formatEid(eid));
                  setScanning(false);
                  return;
                }
              }
              if (results.length) setScanHint('掃到條碼，但不是 EID。請對準標示「EID」的那一條條碼');
            }
          } catch { /* 單張畫面失敗就下一張 */ }
          timer = window.setTimeout(tick, 250);
        };
        void tick();
      } catch (error) {
        const name = (error as { name?: string })?.name;
        setScanError(name === 'NotAllowedError' ? '沒有相機權限，請到瀏覽器設定允許使用相機，或直接手動輸入' : '這個裝置無法開啟相機掃描，請手動輸入 EID');
        setScanning(false);
      }
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [scanning]);

  const choices = knownEids.filter(eid => eid !== digits);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-white/55">
        把{count > 1 ? `這 ${count} 張` : '這張'} eSIM 指定給一張 eSIM 晶片卡。之後在一飛通 App 用讀卡機讀到這張晶片，就會直接列出要安裝的卡。
        EID 是 89 開頭的 32 位數字，印在晶片卡包裝或卡片背面。
      </p>

      <label className="block">
        <span className="text-xs text-white/45">EID</span>
        <div className={`mt-1 flex items-center gap-2 rounded-xl border bg-black/30 px-3 ${showError ? 'border-red-400/60' : valid ? 'border-emerald-400/50' : 'border-white/10 focus-within:border-cyan-400'}`}>
          <input
            value={value}
            onChange={e => { setValue(e.target.value); setScanHint(''); }}
            inputMode="numeric"
            autoComplete="off"
            placeholder="8904 9032 0000 0000 0000 0000 0000 0000"
            className="h-11 min-w-0 flex-1 bg-transparent font-mono text-sm tracking-wide text-white outline-none placeholder:text-white/20"
          />
          {valid && <Check size={18} className="shrink-0 text-emerald-300" />}
          {value && <button type="button" onClick={() => setValue('')} aria-label="清空" className="shrink-0 text-white/40"><X size={16} /></button>}
        </div>
        <span className={`mt-1 block text-[11px] ${showError ? 'text-red-300' : 'text-white/35'}`}>
          {showError ? 'EID 檢查碼不正確，請再核對一次' : `${digits.length}/32 位數字`}
        </span>
      </label>

      {scanning ? (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
            <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-6 top-1/2 h-16 -translate-y-1/2 rounded-lg border-2 border-cyan-300/80" />
          </div>
          <p className="text-center text-[11px] text-white/50">{scanHint || '把 EID 條碼放進框裡，靠近一點、保持清楚'}</p>
          <button type="button" onClick={() => setScanning(false)} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 text-sm font-bold text-white/80">
            <CameraOff size={16} />停止掃描
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => { setScanError(''); setScanHint(''); setScanning(true); }} className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-sm font-bold text-cyan-100">
          <Camera size={17} />用相機掃描條碼
        </button>
      )}
      {scanError && <p className="text-xs text-amber-200">{scanError}</p>}

      {choices.length > 0 && (
        <div>
          <p className="text-xs text-white/40">最近用過的晶片</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {choices.slice(0, 8).map(eid => (
              <button key={eid} type="button" onClick={() => setValue(formatEid(eid))} title={formatEid(eid)} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-xs text-white/75">
                EID {shortEid(eid)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {initialEid && (
          <button type="button" disabled={saving} onClick={() => onSave(null)} className="h-11 rounded-xl border border-red-400/30 bg-red-500/10 px-4 text-sm font-bold text-red-200 disabled:opacity-40">
            取消指定
          </button>
        )}
        <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-xl border border-white/15 text-sm font-bold text-white/75">返回</button>
        <button type="button" disabled={!valid || saving} onClick={() => onSave(digits)} className="h-11 flex-1 rounded-xl bg-cyan-400 text-sm font-black text-[#071317] disabled:opacity-40">
          {saving ? '儲存中...' : '儲存'}
        </button>
      </div>
    </div>
  );
}
