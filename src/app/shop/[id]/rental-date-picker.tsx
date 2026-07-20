"use client";

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';

export interface RentalSelection {
  startDate: string;
  endDate: string;
  days: number;
}

interface Reservation {
  date: string;
  remainingQuantity: number;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function daysInclusive(start: string, end: string) {
  return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86_400_000) + 1;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric' }).format(parseDate(value));
}

export default function RentalDatePicker({
  productId,
  onChange
}: {
  productId: string;
  onChange: (selection: RentalSelection | null) => void;
}) {
  const today = useMemo(() => startOfToday(), []);
  const maxDate = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() + 364);
    return date;
  }, [today]);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/shop/products/${productId}/availability?from=${toDateString(today)}&to=${toDateString(maxDate)}`, {
      signal: controller.signal,
      cache: 'no-store'
    }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '租借日期載入失敗');
      setBlockedDates(new Set((result.reservations as Reservation[] || [])
        .filter(item => item.remainingQuantity <= 0)
        .map(item => item.date)));
      setAvailabilityReady(true);
    }).catch(fetchError => {
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
      setError(fetchError instanceof Error ? fetchError.message : '租借日期載入失敗');
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [maxDate, productId, today]);

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const values: Array<Date | null> = Array(first.getDay()).fill(null);
    for (let day = 1; day <= last.getDate(); day += 1) {
      values.push(new Date(month.getFullYear(), month.getMonth(), day));
    }
    while (values.length % 7) values.push(null);
    return values;
  }, [month]);

  const chooseDate = (date: Date) => {
    const value = toDateString(date);
    if (blockedDates.has(value) || date < today || date > maxDate) return;
    setError('');

    if (!startDate || endDate || date < parseDate(startDate)) {
      setStartDate(value);
      setEndDate('');
      onChange(null);
      return;
    }

    const cursor = new Date(parseDate(startDate));
    while (cursor <= date) {
      if (blockedDates.has(toDateString(cursor))) {
        setError(`${formatShortDate(toDateString(cursor))} 已被預約，請改選其他租期`);
        setStartDate(value);
        setEndDate('');
        onChange(null);
        return;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    setEndDate(value);
    onChange({ startDate, endDate: value, days: daysInclusive(startDate, value) });
  };

  const canGoPrevious = month > new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoNext = month < new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  const isInRange = (value: string) => startDate && value >= startDate && (!endDate || value <= endDate);

  return <div className="mt-5 rounded-md border border-black/10 bg-[#f7f9f8] p-4">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div><p className="flex items-center gap-2 text-sm font-bold"><CalendarDays size={17} /> 選擇租借日期</p><p className="mt-1 text-xs leading-5 text-black/45">先選取開始日，再選取歸還日；起訖日都會計入租借天數。</p></div>
      {loading && <LoaderCircle className="mt-1 animate-spin text-[#247253]" size={18} />}
    </div>

    <div className="flex items-center justify-between">
      <button type="button" title="上個月" disabled={!canGoPrevious} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center rounded-md border border-black/10 bg-white disabled:opacity-25"><ChevronLeft size={18} /></button>
      <p className="font-bold">{month.getFullYear()} 年 {month.getMonth() + 1} 月</p>
      <button type="button" title="下個月" disabled={!canGoNext} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center rounded-md border border-black/10 bg-white disabled:opacity-25"><ChevronRight size={18} /></button>
    </div>

    <div className="mt-3 grid grid-cols-7 gap-1 text-center">
      {WEEKDAYS.map(day => <div key={day} className="py-2 text-xs font-semibold text-black/40">{day}</div>)}
      {calendarDays.map((date, index) => {
        if (!date) return <div key={`blank-${index}`} className="aspect-square" />;
        const value = toDateString(date);
        const isPast = date < today;
        const isFuture = date > maxDate;
        const blocked = blockedDates.has(value);
        const selected = value === startDate || value === endDate;
        const inRange = Boolean(isInRange(value));
        return <button
          type="button"
          key={value}
          title={blocked ? '已被預約' : value}
          disabled={loading || !availabilityReady || isPast || isFuture || blocked}
          onClick={() => chooseDate(date)}
          className={`aspect-square rounded-md text-sm font-semibold transition-colors ${selected ? 'bg-[#247253] text-white' : inRange ? 'bg-[#dceee7] text-[#174d38]' : blocked ? 'bg-black/8 text-black/25 line-through' : isPast || isFuture ? 'text-black/15' : 'bg-white text-black/65 hover:bg-[#dceee7]'}`}
        >{date.getDate()}</button>;
      })}
    </div>

    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-black/45"><span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-[#247253]" /> 已選日期</span><span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-black/10" /> 已被預約</span></div>
    {startDate && <div className="mt-4 rounded-md bg-white px-3 py-3 text-sm"><span className="text-black/45">租借期間：</span><strong>{formatShortDate(startDate)}</strong><span className="mx-2">至</span><strong>{endDate ? formatShortDate(endDate) : '請選歸還日'}</strong>{endDate && <span className="ml-2 text-[#247253]">共 {daysInclusive(startDate, endDate)} 天</span>}</div>}
    {error && <p className="mt-3 text-sm font-semibold text-[#c43b4e]">{error}</p>}
  </div>;
}
