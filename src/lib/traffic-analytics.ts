import type { AnalyticsEventType } from '@/lib/analytics';

const ANALYTICS_PATTERN = /\n?<!--TRAFFIC_ANALYTICS:([A-Za-z0-9+/=]+)-->\n?/;

interface CounterValue {
  total: number;
  today: number;
}

export interface TrafficAnalytics {
  date: string;
  counters: Record<AnalyticsEventType, CounterValue>;
}

export function getTaipeiDateKey() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function createEmptyAnalytics(date = getTaipeiDateKey()): TrafficAnalytics {
  return {
    date,
    counters: {
      topup_page_view: { total: 0, today: 0 },
      roamlink_page_view: { total: 0, today: 0 },
      topup_to_roamlink_click: { total: 0, today: 0 }
    }
  };
}

export function parseTrafficAnalytics(usageGuide: string | null) {
  const today = getTaipeiDateKey();
  const match = (usageGuide || '').match(ANALYTICS_PATTERN);
  if (!match?.[1]) return createEmptyAnalytics(today);

  try {
    const stored = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')) as Partial<TrafficAnalytics>;
    const result = createEmptyAnalytics(today);
    const storedCounters = stored.counters || {} as TrafficAnalytics['counters'];
    (Object.keys(result.counters) as AnalyticsEventType[]).forEach(eventType => {
      result.counters[eventType].total = Math.max(0, Number(storedCounters[eventType]?.total || 0));
      result.counters[eventType].today = stored.date === today
        ? Math.max(0, Number(storedCounters[eventType]?.today || 0))
        : 0;
    });
    return result;
  } catch {
    return createEmptyAnalytics(today);
  }
}

export function withTrafficAnalytics(usageGuide: string | null, analytics: TrafficAnalytics) {
  const cleanGuide = (usageGuide || '').replace(ANALYTICS_PATTERN, '').trim();
  const encoded = Buffer.from(JSON.stringify(analytics), 'utf8').toString('base64');
  return `${cleanGuide}${cleanGuide ? '\n\n' : ''}<!--TRAFFIC_ANALYTICS:${encoded}-->`;
}
