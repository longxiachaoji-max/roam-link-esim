import {
  normalizeMicroesimDate,
  type MicroesimDeviceDetail,
  type MicroesimEventDetail
} from '@/lib/microesim';
import { deriveMicroesimUsageStatus } from '@/lib/microesim-usage-status';

export interface MicroesimUsageSummary {
  status: string;
  usedData: string | null;
  remainingData: string | null;
  totalData: string | null;
  installedAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  installationDeadline: string | null;
}

export function normalizeMicroesimUsage(
  detail: MicroesimDeviceDetail,
  events: MicroesimEventDetail[],
  installationDeadline: string | null
): MicroesimUsageSummary {
  const successfulEvents = events
    .filter(event => !event.notification_status || /success/i.test(event.notification_status))
    .sort((a, b) => String(a.event_date || '').localeCompare(String(b.event_date || '')));
  const lastEvent = successfulEvents.at(-1)?.notify_type?.toUpperCase() || '';
  const installedEvent = [...successfulEvents].reverse().find(event => event.notify_type?.toUpperCase() === 'INSTALLED');
  const downloadedEvent = [...successfulEvents].reverse().find(event => event.notify_type?.toUpperCase() === 'DOWNLOADED');
  const activatedAt = normalizeMicroesimDate(detail.active_time);
  const supplierStatus = String(detail.status || '').trim().toUpperCase();
  const usageState = deriveMicroesimUsageStatus({
    supplierStatus,
    lastEvent,
    hasInstalledEvent: Boolean(installedEvent),
    hasDownloadedEvent: Boolean(downloadedEvent),
    activatedAt,
    expiresAt: normalizeMicroesimDate(detail.expire_time),
    terminatedAt: normalizeMicroesimDate(detail.terminate_time)
  });

  return {
    status: usageState.status,
    usedData: detail.data_usage === undefined || detail.data_usage === '' ? null : String(detail.data_usage),
    remainingData: null,
    totalData: null,
    installedAt: normalizeMicroesimDate(installedEvent?.event_date || downloadedEvent?.event_date),
    activatedAt,
    expiresAt: usageState.expiresAt,
    installationDeadline
  };
}
