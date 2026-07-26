export interface MicroesimUsageDisplayFields {
  status: string;
  installedAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  installationDeadline: string | null;
}

interface MicroesimUsageStatusInput {
  supplierStatus: string;
  lastEvent: string;
  hasInstalledEvent: boolean;
  hasDownloadedEvent: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
  terminatedAt: string | null;
  now?: number;
}

const ACTIVE_STATUSES = new Set(['ACTIVE', 'ACTIVATED', 'IN_USE']);
const EXPIRED_STATUSES = new Set(['EXPIRE', 'EXPIRED']);
const DELETED_STATUSES = new Set(['DELETE', 'DELETED']);
const TERMINATED_STATUSES = new Set(['TERMINATE', 'TERMINATED']);

export function deriveMicroesimUsageStatus(input: MicroesimUsageStatusInput) {
  const supplierStatus = input.supplierStatus.trim().toUpperCase();
  const activationConfirmed = Boolean(input.activatedAt) || ACTIVE_STATUSES.has(supplierStatus);
  const expiresAt = activationConfirmed ? input.expiresAt : null;
  const expiryTime = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  const isExpiredByDate = Number.isFinite(expiryTime) && expiryTime <= (input.now ?? Date.now());

  let status = '尚未安裝';
  if (input.lastEvent === 'DELETE' || DELETED_STATUSES.has(supplierStatus)) status = '已刪除';
  else if (input.terminatedAt || TERMINATED_STATUSES.has(supplierStatus)) status = '已停用';
  else if (activationConfirmed && (isExpiredByDate || EXPIRED_STATUSES.has(supplierStatus))) status = '已到期';
  else if (activationConfirmed) status = '已啟用';
  else if (input.hasInstalledEvent || supplierStatus === 'INSTALLED') status = '已安裝';
  else if (input.hasDownloadedEvent || supplierStatus === 'DOWNLOADED') status = '已下載';

  return { status, expiresAt };
}

export function sanitizeMicroesimUsageForDisplay<T extends MicroesimUsageDisplayFields>(usage: T): T {
  if (usage.activatedAt || usage.status === '已啟用') return usage;

  const isPreActivationStatus = ['尚未安裝', '已下載', '已安裝', '已到期'].includes(usage.status);
  if (!isPreActivationStatus || (!usage.expiresAt && usage.status !== '已到期')) return usage;

  return {
    ...usage,
    status: usage.status === '已到期'
      ? (usage.installedAt ? '已安裝' : '尚未安裝')
      : usage.status,
    expiresAt: null
  };
}
