'use client';

// 累計用量曲線：橫軸日期時間、縱軸累計用量；滑過／點一下看該時間點的用量和增加量
import { useMemo, useRef, useState } from 'react';

export interface UsagePoint { t: number; mb: number; status: string | null }

const W = 420;
const H = 190;
const PAD = { top: 10, right: 8, bottom: 26, left: 40 };
const tz = 'Asia/Taipei';
const fmtDate = new Intl.DateTimeFormat('zh-TW', { timeZone: tz, month: 'numeric', day: 'numeric' });
const fmtDateTime = new Intl.DateTimeFormat('zh-TW', { timeZone: tz, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const fmtTime = new Intl.DateTimeFormat('zh-TW', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });

export const formatUsageMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`);

function niceStep(max: number, count: number) {
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export function UsageChart({ points }: { points: UsagePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const chart = useMemo(() => {
    const t0 = points[0].t;
    const t1 = Math.max(points[points.length - 1].t, t0 + 60 * 60 * 1000);
    const maxMb = Math.max(...points.map(p => p.mb), 1);
    // 縱軸用 MB 或 GB 的整數刻度
    const useGb = maxMb >= 1024;
    const unit = useGb ? 1024 : 1;
    const step = niceStep(maxMb / unit, 4) * unit;
    const yMax = Math.ceil(maxMb / step) * step;
    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
    const y = (mb: number) => H - PAD.bottom - (mb / yMax) * (H - PAD.top - PAD.bottom);
    const yTicks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
    // 橫軸：超過 4 天只顯示日期（同一天只標一次），4 天內顯示日期＋時間，一天內只顯示時間
    const span = t1 - t0;
    const tickLabel = (t: number) => (span > 4 * 86400e3 ? fmtDate.format(t) : span > 30 * 3600e3 ? `${fmtDate.format(t)} ${fmtTime.format(t)}` : fmtTime.format(t));
    const xTicks: { t: number; label: string }[] = [];
    const count = span > 4 * 86400e3 ? 5 : span > 30 * 3600e3 ? 3 : 4;
    for (let i = 0; i <= count - 1; i++) {
      const t = t0 + (span * i) / (count - 1);
      const label = tickLabel(t);
      if (!xTicks.some(tick => tick.label === label)) xTicks.push({ t, label });
    }
    // 階梯線：兩次紀錄之間用量維持上一個數字，有新紀錄才往上跳
    let line = `M${x(points[0].t)},${y(points[0].mb)}`;
    for (let i = 1; i < points.length; i++) line += ` H${x(points[i].t)} V${y(points[i].mb)}`;
    const area = `${line} V${y(0)} H${x(points[0].t)} Z`;
    return { x, y, yTicks, xTicks, line, area, useGb };
  }, [points]);

  const pick = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 0; i < points.length; i++) if (Math.abs(chart.x(points[i].t) - px) < Math.abs(chart.x(points[best].t) - px)) best = i;
    setHover(best);
  };

  const active = hover != null ? points[hover] : null;
  const previous = hover != null && hover > 0 ? points[hover - 1] : null;
  const delta = active && previous ? active.mb - previous.mb : null;
  const tipLeft = active ? Math.min(Math.max((chart.x(active.t) / W) * 100, 18), 82) : 0;

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y"
        role="img"
        aria-label={`累計用量曲線，目前 ${formatUsageMb(points[points.length - 1].mb)}`}
        onPointerMove={e => pick(e.clientX)}
        onPointerDown={e => pick(e.clientX)}
        onPointerLeave={e => { if (e.pointerType === 'mouse') setHover(null); }}
      >
        {chart.yTicks.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={chart.y(v)} y2={chart.y(v)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <text x={PAD.left - 8} y={chart.y(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="rgba(255,255,255,0.45)">
              {chart.useGb ? `${+(v / 1024).toFixed(2)}G` : `${Math.round(v)}M`}
            </text>
          </g>
        ))}
        {chart.xTicks.map(({ t, label }, i) => (
          <text key={t} x={chart.x(t)} y={H - PAD.bottom + 16} textAnchor={i === 0 ? 'start' : i === chart.xTicks.length - 1 ? 'end' : 'middle'} fontSize={10} fill="rgba(255,255,255,0.45)">
            {label}
          </text>
        ))}
        <path d={chart.area} fill="rgba(34,211,238,0.14)" />
        <path d={chart.line} fill="none" stroke="#22d3ee" strokeWidth={2} strokeLinejoin="round" />
        {active && (
          <>
            <line x1={chart.x(active.t)} x2={chart.x(active.t)} y1={PAD.top} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.35)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={chart.x(active.t)} cy={chart.y(active.mb)} r={5} fill="#22d3ee" stroke="#1A1A2E" strokeWidth={2} />
          </>
        )}
        {!active && (
          <circle cx={chart.x(points[points.length - 1].t)} cy={chart.y(points[points.length - 1].mb)} r={4} fill="#22d3ee" stroke="#1A1A2E" strokeWidth={2} />
        )}
      </svg>
      {active && (
        <div className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-lg border border-white/15 bg-[#0f0f1c]/95 px-2.5 py-1.5 text-[11px] leading-4 shadow-lg" style={{ left: `${tipLeft}%` }}>
          <p className="text-white/55">{fmtDateTime.format(active.t)}</p>
          <p className="font-mono text-sm font-bold text-white">{formatUsageMb(active.mb)}</p>
          {delta != null && <p className="text-white/55">{delta > 0 ? `比上一筆 +${formatUsageMb(delta)}` : '沒有增加'}</p>}
          {active.status && <p className="text-white/40">{active.status}</p>}
        </div>
      )}
    </div>
  );
}
