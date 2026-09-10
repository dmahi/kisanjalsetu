import type { ReactNode } from 'react';

export function formatINR(paise: number): string {
  const val = Math.round(paise) / 100;
  const neg = val < 0;
  const abs = Math.abs(val);
  const [int, frac] = abs.toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}₹${grouped}.${frac}`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDateOnly(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export const ROLE_LABEL: Record<string, string> = {
  farmer: 'Farmer',
  tubewell_owner: 'Owner',
  admin: 'Admin',
};

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function toneFor(status?: string): string {
  switch (status) {
    case 'active':
    case 'approved':
    case 'paid':
      return 'green';
    case 'running':
      return 'blue';
    case 'pending':
    case 'partially_paid':
      return 'amber';
    case 'cancelled':
    case 'suspended':
    case 'rejected':
    case 'unpaid':
      return 'red';
    default:
      return 'gray';
  }
}

export function Spinner() {
  return <div className="spinner" />;
}