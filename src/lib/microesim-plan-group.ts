export interface MicroesimPlanGroupingInput {
  name?: string;
  data_amount?: string;
  rule_desc_zh?: string;
  customer_note?: string;
  supplier_plan_name?: string;
  raw?: Record<string, unknown>;
}

export function getMicroesimPlanSpeedTier(plan: MicroesimPlanGroupingInput) {
  const raw = plan.raw || {};
  const text = [
    plan.name,
    plan.data_amount,
    plan.rule_desc_zh,
    plan.customer_note,
    plan.supplier_plan_name,
    raw.channel_dataplan_name,
    raw.data,
    raw.rule_desc,
    raw.special_desc
  ].filter(value => typeof value === 'string' || typeof value === 'number').join(' ').toLowerCase();
  const isUnlimited = text.includes('吃到飽') || /unlimited|吃放題|無限/.test(text);
  if (!isUnlimited) return '';

  const explicitSpeed = text.match(/(\d+(?:\.\d+)?)\s*(mbps|kbps|kb)\b/i);
  const rawRule = String(raw.rule_desc || '');
  const shorthandSpeed = rawRule.match(/(\d+(?:\.\d+)?)\s*m\b/i);
  const speed = explicitSpeed || shorthandSpeed;
  if (!speed) return '高速不限速';

  const rawUnit = (speed[2] || 'mbps').toLowerCase();
  const unit = rawUnit === 'kb' ? 'kbps' : rawUnit === 'm' ? 'Mbps' : rawUnit;
  return `最高 ${speed[1]}${unit}`;
}
