import {
  normalizeMicroesimDate,
  type MicroesimDeviceDetail,
  type MicroesimEventDetail
} from '@/lib/microesim';

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
  const expiresAt = normalizeMicroesimDate(detail.expire_time);
  const isExpired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
  const supplierStatus = String(detail.status || '').trim().toUpperCase();

  let status = '尚未安裝';
  if (lastEvent === 'DELETE' || ['DELETE', 'DELETED'].includes(supplierStatus)) status = '已刪除';
  else if (detail.terminate_time || ['TERMINATE', 'TERMINATED'].includes(supplierStatus)) status = '已停用';
  else if (isExpired || ['EXPIRE', 'EXPIRED'].includes(supplierStatus)) status = '已到期';
  else if (activatedAt || ['ACTIVE', 'ACTIVATED', 'IN_USE'].includes(supplierStatus)) status = '已啟用';
  else if (installedEvent || supplierStatus === 'INSTALLED') status = '已安裝';
  else if (lastEvent === 'DOWNLOADED' || supplierStatus === 'DOWNLOADED') status = '已下載';

  return {
    status,
    usedData: detail.data_usage === undefined || detail.data_usage === '' ? null : String(detail.data_usage),
    remainingData: null,
    totalData: null,
    installedAt: normalizeMicroesimDate(installedEvent?.event_date || downloadedEvent?.event_date),
    activatedAt,
    expiresAt,
    installationDeadline
  };
}
