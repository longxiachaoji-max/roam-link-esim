import assert from 'node:assert/strict';
import test from 'node:test';
import { transformMicroesimPlan, type MicroesimPlan } from '../../src/lib/microesim.ts';
import { getMicroesimPlanSpeedTier } from '../../src/lib/microesim-plan-group.ts';

function createPlan(overrides: Partial<MicroesimPlan> = {}): MicroesimPlan {
  return {
    channel_dataplan_id: 'plan-1',
    channel_dataplan_name: 'Japan-Daily1GB-5-A0',
    price: '10',
    currency: 'HKD',
    status: 'active',
    day: 5,
    data: 'Daily1GB',
    code: 'JP',
    ...overrides
  };
}

test('leaves hotspot text empty when the supplier gives no hotspot information', () => {
  const plan = transformMicroesimPlan(createPlan(), { countryCode: 'JP', countryName: '日本' });

  assert.equal(plan.hotspot_sharing, '');
  assert.equal(plan.customer_note, '');
});

test('keeps explicit hotspot limits supplied in the plan data', () => {
  const plan = transformMicroesimPlan(createPlan({ special_desc: 'Hotspot 2GB' }), {
    countryCode: 'JP',
    countryName: '日本'
  });

  assert.equal(plan.hotspot_sharing, '熱點分享2GB');
  assert.match(plan.customer_note, /熱點分享2GB/);
});

test('keeps an explicit no-hotspot warning', () => {
  const plan = transformMicroesimPlan(createPlan({ special_desc: 'Hotspot not supported' }), {
    countryCode: 'JP',
    countryName: '日本'
  });

  assert.equal(plan.hotspot_sharing, '不支援熱點分享');
});

test('recognizes the supplier Unlimited 10M shorthand as a 10Mbps capped plan', () => {
  const plan = transformMicroesimPlan(createPlan({
    channel_dataplan_name: 'Thailand-Local-unlimited-7-D0',
    data: 'Unlimited',
    rule_desc: 'Unlimited 10M'
  }), { countryCode: 'TH', countryName: '泰國' });

  assert.equal(plan.data_amount, '吃到飽，最高速率10mbps');
  assert.equal(plan.flags.speedLimit, true);
  assert.equal(getMicroesimPlanSpeedTier(plan), '最高 10mbps');
});

test('keeps Unlimited High Speed in a separate uncapped group', () => {
  const plan = transformMicroesimPlan(createPlan({
    channel_dataplan_name: 'Thailand-Local-unlimited-8-D0',
    data: 'Unlimited',
    rule_desc: 'Unlimited High Speed'
  }), { countryCode: 'TH', countryName: '泰國' });

  assert.equal(plan.data_amount, '吃到飽');
  assert.equal(plan.flags.speedLimit, false);
  assert.equal(getMicroesimPlanSpeedTier(plan), '高速不限速');
});
