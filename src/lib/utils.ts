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
  // Route null/undefined through the same Intl formatter as a real zero
  // rather than a hand-typed fallback string - the hardcoded 'R0.00' this
  // used to return didn't match en-ZA's actual formatting of 0 ('R 0,00',
  // space + comma decimal), so a missing cost and a genuinely-zero cost
  // rendered as two visibly different strings for what should look like
  // the same "no cost" state. Caught by testing both cases side by side,
  // not by inspection.
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount ?? 0);
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
