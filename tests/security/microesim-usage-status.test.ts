import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveMicroesimUsageStatus,
  sanitizeMicroesimUsageForDisplay
} from '../../src/lib/microesim-usage-status.ts';

const baseInput = {
  supplierStatus: 'success',
  lastEvent: '',
  hasInstalledEvent: false,
  hasDownloadedEvent: false,
  activatedAt: null,
  expiresAt: '2026-07-25T00:00:00.000Z',
  terminatedAt: null,
  now: new Date('2026-07-26T00:00:00.000Z').getTime()
};

test('does not expire an eSIM before activation', () => {
  assert.deepEqual(deriveMicroesimUsageStatus({
    ...baseInput,
    supplierStatus: 'expired'
  }), {
    status: '尚未安裝',
    expiresAt: null
  });
});

test('uses the plan expiry only after activation', () => {
  assert.deepEqual(deriveMicroesimUsageStatus({
    ...baseInput,
    activatedAt: '2026-07-20T00:00:00.000Z'
  }), {
    status: '已到期',
    expiresAt: '2026-07-25T00:00:00.000Z'
  });
});

test('keeps installed and activated states separate', () => {
  assert.deepEqual(deriveMicroesimUsageStatus({
    ...baseInput,
    hasInstalledEvent: true
  }), {
    status: '已安裝',
    expiresAt: null
  });
});

test('repairs a legacy cache that marked an unactivated eSIM as expired', () => {
  assert.deepEqual(sanitizeMicroesimUsageForDisplay({
    status: '已到期',
    installedAt: null,
    activatedAt: null,
    expiresAt: '2026-07-25T00:00:00.000Z',
    installationDeadline: '2026-09-18T00:00:00.000Z'
  }), {
    status: '尚未安裝',
    installedAt: null,
    activatedAt: null,
    expiresAt: null,
    installationDeadline: '2026-09-18T00:00:00.000Z'
  });
});
