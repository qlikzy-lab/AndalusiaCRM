import type { LeadStatus } from './types';

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'interested',
  'hot',
  'cold',
  'enrolled',
  'unknown',
];

// English UI labels for built-in statuses.
export const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  interested: 'Interested',
  hot: 'Hot',
  cold: 'Cold',
  enrolled: 'Enrolled',
  unknown: 'Unknown',
};

/**
 * Tailwind badge classes per built-in status.
 * Full literal strings so Tailwind's scanner keeps them.
 */
export const STATUS_BADGE_CLASSES: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  interested: 'bg-orange-50 text-orange-700 border-orange-200',
  hot: 'bg-green-50 text-green-700 border-green-200',
  cold: 'bg-gray-100 text-gray-600 border-gray-300',
  enrolled: 'bg-purple-50 text-purple-700 border-purple-200',
  unknown: 'bg-amber-50 text-amber-700 border-amber-200',
};

// Fallback badge style for custom statuses.
const CUSTOM_BADGE_CLASS = 'bg-slate-100 text-slate-700 border-slate-300';

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function getStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status] ?? CUSTOM_BADGE_CLASS;
}

export function isBuiltInStatus(value: unknown): value is LeadStatus {
  return typeof value === 'string' && LEAD_STATUSES.includes(value);
}

/** Coerce AI output to a known built-in status, defaulting to 'unknown'. */
export function coerceStatus(value: unknown): LeadStatus {
  return isBuiltInStatus(value) ? value : 'unknown';
}
