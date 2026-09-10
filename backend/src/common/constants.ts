export const ROLES = {
  ADMIN: 'admin',
  FARMER: 'farmer',
  TUBEWELL_OWNER: 'tubewell_owner',
  OPERATOR: 'operator',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const USER_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const;

export const TUBEWELL_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const;

export const TUBEWELL_TYPE = {
  MOTOR_PUMP: 'motor_pump',
  SUBMERSIBLE_PUMP: 'submersible_pump',
} as const;

export const MEMBERSHIP_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
} as const;

export const SESSION_STATUS = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
} as const;

export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
} as const;

export const PAYMENT_METHOD = {
  CASH: 'cash',
  UPI: 'upi',
  BANK_TRANSFER: 'bank_transfer',
  OTHER: 'other',
} as const;

export const PAYMENT_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export const DISCOUNT_TYPE = {
  FIXED: 'fixed',
  PERCENTAGE: 'percentage',
} as const;

export const BILLING_ROUNDING = {
  UP: 'up',
  DOWN: 'down',
  NEAREST: 'nearest',
} as const;

export const DEFAULT_CROPS = [
  'Wheat',
  'Paddy',
  'Mustard',
  'Cotton',
  'Sugarcane',
  'Maize',
  'Bajra',
  'Vegetables',
  'Other',
];