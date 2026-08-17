import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export function formatCurrencyZAR(amount: number | null | undefined): string {
  if (amount == null) return 'R0.00';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

export const JOB_TYPE_LABELS: Record<string, string> = {
  service: 'Service',
  mechanical_repair: 'Mechanical Repair',
  panel_beating: 'Panel Beating',
  towing: 'Towing',
  accident_repair: 'Accident Repair',
  specialist: 'Specialist',
  compliance: 'Compliance',
  other: 'Other',
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  waiting_for_parts: 'Waiting for Parts',
  completed: 'Completed',
  submitted: 'Submitted',
  paid: 'Paid',
};

export const DOC_TYPE_LABELS: Record<string, string> = {
  cof: 'Certificate of Fitness',
  roadworthy_certificate: 'Roadworthy Certificate',
  business_licence: 'Business Licence',
  insurance: 'Insurance',
  tax_clearance: 'Tax Clearance',
  bbbee: 'B-BBEE Certificate',
  other: 'Other',
};
