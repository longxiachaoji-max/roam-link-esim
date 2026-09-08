'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  BadgePercent,
  Camera,
  Globe2,
  MessageCircle,
  Plane,
  Share2,
  Store,
  Wifi
} from 'lucide-react';
import { OFFICIAL_INSTAGRAM_URL, OFFICIAL_THREADS_URL } from '@/lib/social-profiles';

const links = [
  { label: '前往官網', description: '查看熱門國家 eSIM 方案', href: 'https://firstesim.space', icon: Globe2, accent: 'from-cyan-300 to-sky-500' },
  { label: 'LINE 客服', description: '訂單、安裝與旅遊上網諮詢', href: 'https://lin.ee/Td0EgHE', icon: MessageCircle, accent: 'from-emerald-300 to-[#06c755]' },
  { label: 'Instagram', description: '旅遊上網資訊與優惠活動', href: OFFICIAL_INSTAGRAM_URL, icon: Camera, accent: 'from-fuchsia-400 via-rose-400 to-amber-300' },
  { label: 'Threads', description: '追蹤一飛通最新消息', href: OFFICIAL_THREADS_URL, icon: Share2, accent: 'from-white to-slate-300' },
  { label: '經銷合作', description: '申請經銷商帳號與合作販售', href: 'https://firstesim.space/dealer', icon: Store, accent: 'from-[#ff6b86] to-[#ffd36b]' }
];

export default function CardExperience() {
  const shellRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const orientationBaselineRef = useRef<{ beta: number; gamma: number } | null>(null);

  const setGlassMotion = (x: number, y: number, immediate = true) => {
    const shell = shellRef.current;
    if (!shell) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    frameRef.current = requestAnimationFrame(() => {
      shell.dataset.interacting = immediate ? 'true' : 'false';
      shell.style.setProperty('--card-rotate-x', `${(-y * 3.2).toFixed(2)}deg`);
      shell.style.setProperty('--card-rotate-y', `${(x * 3.8).toFixed(2)}deg`);
      shell.style.setProperty('--card-light-x', `${(50 + x * 34).toFixed(1)}%`);
      shell.style.setProperty('--card-light-y', `${(42 + y * 30).toFixed(1)}%`);
      frameRef.current = null;
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2));
    setGlassMotion(x, y);
  };

  useEffect(() => {
    const updateScrollLight = () => {
      const shell = shellRef.current;
      if (!shell) return;
      const pageRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, window.scrollY / pageRange));
      shell.style.setProperty('--card-scroll-shift', `${(-6 + progress * 12).toFixed(1)}%`);
    };

    updateScrollLight();
    window.addEventListener('scroll', updateScrollLight, { passive: true });

    const resetOrientationBaseline = () => {
      orientationBaselineRef.current = null;
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null || !shellRef.current) return;
      if (!orientationBaselineRef.current) {
        orientationBaselineRef.current = { beta: event.beta, gamma: event.gamma };
        shellRef.current.dataset.sensorActive = 'true';
        return;
      }

      const betaDelta = event.beta - orientationBaselineRef.current.beta;
      const gammaDelta = event.gamma - orientationBaselineRef.current.gamma;
      const screenAngle = window.screen.orientation?.angle || 0;
      let x = gammaDelta / 22;
      let y = betaDelta / 22;

      if (screenAngle === 90) {
        x = betaDelta / 22;
        y = -gammaDelta / 22;
      } else if (screenAngle === 270) {
        x = -betaDelta / 22;
        y = gammaDelta / 22;
      } else if (screenAngle === 180) {
        x = -gammaDelta / 22;
        y = -betaDelta / 22;
      }

      setGlassMotion(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
    };

    // Do not call requestPermission: unsupported or permission-gated browsers use the CSS fallback.
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    window.screen.orientation?.addEventListener('change', resetOrientationBaseline);
    return () => {
      window.removeEventListener('scroll', updateScrollLight);
      window.removeEventListener('deviceorientation', handleOrientation);
      window.screen.orientation?.removeEventListener('change', resetOrientationBaseline);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <main className="card-stage relative min-h-[100svh] overflow-hidden px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="card-stage-light card-stage-light-a" />
      <div className="card-stage-light card-stage-light-b" />
      <div className="card-stage-lines" />

      <section className="relative mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-lg items-center sm:min-h-[calc(100svh-5rem)]">
        <div className="card-glass-enter relative w-full [perspective:1400px]">
          <div className="card-glass-back card-glass-back-far" />
          <div className="card-glass-back card-glass-back-near" />

          <div
            ref={shellRef}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setGlassMotion(0, 0, false)}
            onPointerCancel={() => setGlassMotion(0, 0, false)}
            data-sensor-active="false"
            className="card-glass-shell relative w-full overflow-hidden rounded-[36px] p-2 sm:p-2.5"
          >
            <div className="card-glass-edge-light" />
            <div className="card-glass-inner relative overflow-hidden rounded-[30px] px-5 py-7 text-center sm:px-7 sm:py-8">
              <div className="card-glass-inner-light" />
              <div className="card-logo-frame relative mx-auto grid size-32 place-items-center overflow-hidden rounded-[30px] sm:size-36">
                <Image src="/brand/first-roamlink-logo.png" alt="一飛通全球漫遊 FirstRoamLink" width={1254} height={1254} priority className="h-full w-full object-cover" />
              </div>

              <p className="card-glass-badge relative mt-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold text-cyan-100">
                <Plane size={13} />
                TRAVEL eSIM
              </p>

              <h1 className="relative mt-4 text-3xl font-black tracking-normal sm:text-4xl">
                一飛通全球漫遊
                <span className="mt-1 block bg-gradient-to-r from-cyan-200 via-sky-300 to-teal-200 bg-clip-text text-xl text-transparent sm:text-2xl">FirstRoamLink</span>
              </h1>

              <p className="relative mx-auto mt-4 max-w-sm text-sm leading-7 text-white/68">
                專注旅遊與商務出國上網服務，提供多國 eSIM 方案、快速線上購買與安裝協助。出發前買好，落地就能連線。
              </p>

              <div className="relative mt-6 grid grid-cols-3 gap-2.5 text-left">
                <div className="card-glass-feature rounded-[18px] p-3"><Wifi className="text-cyan-200" size={18} /><p className="mt-2 text-[11px] font-bold text-white/72">免換卡</p></div>
                <div className="card-glass-feature rounded-[18px] p-3"><Globe2 className="text-teal-200" size={18} /><p className="mt-2 text-[11px] font-bold text-white/72">多國上網</p></div>
                <div className="card-glass-feature rounded-[18px] p-3"><BadgePercent className="text-rose-200" size={18} /><p className="mt-2 text-[11px] font-bold text-white/72">經銷合作</p></div>
              </div>
            </div>

            <div className="relative space-y-2.5 px-1 pb-1 pt-3">
              {links.map(({ label, description, href, icon: Icon, accent }, index) => (
                <div key={label} style={{ animationDelay: `${140 + index * 65}ms` }} className="card-glass-link-enter">
                  <Link href={href} target="_blank" rel="noopener noreferrer" className="card-glass-link group relative flex items-center gap-3 overflow-hidden rounded-[22px] p-3.5">
                    <span className="card-glass-link-shine" />
                    <span className={`card-glass-icon grid size-11 shrink-0 place-items-center rounded-[15px] bg-gradient-to-br ${accent} text-[#07101c]`}><Icon size={20} /></span>
                    <span className="relative min-w-0 flex-1 text-left">
                      <span className="block text-sm font-black">{label}</span>
                      <span className="mt-0.5 block truncate text-xs text-white/45">{description}</span>
                    </span>
                    <span className="card-glass-arrow relative grid size-8 shrink-0 place-items-center rounded-full"><ArrowUpRight className="text-white/50" size={16} /></span>
                  </Link>
                </div>
              ))}
            </div>

            <p className="relative px-5 pb-4 pt-3 text-center text-xs leading-5 text-white/38">
              日本、韓國、泰國、越南、中國、中港澳、歐美等旅遊上網方案陸續上架。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
