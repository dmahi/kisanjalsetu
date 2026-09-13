export interface LabelMap {
  en: string;
  hi: string;
  pa: string;
}

export interface SelectOptionSeed {
  category: string;
  code: string;
  labels: LabelMap;
}

export const SELECT_OPTION_CATEGORIES = [
  'tubewell_type',
  'payment_method',
  'discount_type',
  'not_ready_reason',
] as const;

export type SelectOptionCategory = (typeof SELECT_OPTION_CATEGORIES)[number];

export const SELECT_OPTION_DEFAULTS: SelectOptionSeed[] = [
  {
    category: 'tubewell_type',
    code: 'motor_pump',
    labels: { en: 'Motor Pump', hi: 'मोटर पंप', pa: 'ਮੋਟਰ ਪੰਪ' },
  },
  {
    category: 'tubewell_type',
    code: 'submersible_pump',
    labels: { en: 'Submersible Pump', hi: 'सबमर्सिबल पंप', pa: 'ਸਬਮਰਸੀਬਲ ਪੰਪ' },
  },
  {
    category: 'payment_method',
    code: 'cash',
    labels: { en: 'Cash', hi: 'नकद', pa: 'ਨਕਦ' },
  },
  {
    category: 'payment_method',
    code: 'upi',
    labels: { en: 'UPI', hi: 'UPI', pa: 'UPI' },
  },
  {
    category: 'payment_method',
    code: 'bank_transfer',
    labels: { en: 'Bank transfer', hi: 'बैंक ट्रांसफर', pa: 'ਬੈਂਕ ਟ੍ਰਾਂਸਫਰ' },
  },
  {
    category: 'payment_method',
    code: 'other',
    labels: { en: 'Other', hi: 'अन्य', pa: 'ਹੋਰ' },
  },
  {
    category: 'discount_type',
    code: 'fixed',
    labels: { en: 'Fixed (₹)', hi: 'निश्चित (₹)', pa: 'ਨਿਸ਼ਚਿਤ (₹)' },
  },
  {
    category: 'discount_type',
    code: 'percentage',
    labels: { en: 'Percentage', hi: 'प्रतिशत', pa: 'ਪ੍ਰਤੀਸ਼ਤ' },
  },
  {
    category: 'not_ready_reason',
    code: 'finishing_up',
    labels: { en: 'Finishing up', hi: 'पानी निकालना खत्म कर रहा हूँ', pa: 'ਪਾਣੀ ਕੱਢਣਾ ਖਤਮ ਕਰ ਰਿਹਾ ਹਾਂ' },
  },
  {
    category: 'not_ready_reason',
    code: 'not_at_pump',
    labels: { en: 'Not at the pump yet', hi: 'अभी पंप के पास नहीं हूँ', pa: 'ਅਜੇ ਪੰਪ ਕੋਲ ਨਹੀਂ ਹਾਂ' },
  },
  {
    category: 'not_ready_reason',
    code: 'field_not_ready',
    labels: { en: 'Field not ready', hi: 'खेत तैयार नहीं है', pa: 'ਖੇਤ ਤਿਆਰ ਨਹੀਂ ਹੈ' },
  },
  {
    category: 'not_ready_reason',
    code: 'water_not_needed',
    labels: { en: 'Water not needed right now', hi: 'अभी पानी की जरूरत नहीं है', pa: 'ਹੁਣ ਪਾਣੀ ਦੀ ਲੋੜ ਨਹੀਂ' },
  },
  {
    category: 'not_ready_reason',
    code: 'other',
    labels: { en: 'Other', hi: 'अन्य', pa: 'ਹੋਰ' },
  },
];