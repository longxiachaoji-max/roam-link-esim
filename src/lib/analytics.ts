export type AnalyticsEventType =
  | 'topup_page_view'
  | 'roamlink_page_view'
  | 'topup_to_roamlink_click';

const VISITOR_ID_KEY = 'roamlink_analytics_visitor_id';

function getVisitorId() {
  let visitorId = window.localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
}

export function trackAnalyticsEvent(eventType: AnalyticsEventType) {
  try {
    void fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        visitorId: getVisitorId(),
        sourcePath: window.location.pathname
      }),
      keepalive: true
    });
  } catch {
    // Analytics must never interrupt shopping or payment flows.
  }
}

export function trackPageView(eventType: Extract<AnalyticsEventType, 'topup_page_view' | 'roamlink_page_view'>) {
  const sessionKey = `roamlink_analytics_${eventType}`;
  if (window.sessionStorage.getItem(sessionKey)) return;
  window.sessionStorage.setItem(sessionKey, '1');
  trackAnalyticsEvent(eventType);
}
