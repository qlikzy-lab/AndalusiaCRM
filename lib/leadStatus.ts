import type { LeadStatus } from './types';

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'interested',
  'hot',
  'cold',
  'enrolled',
  'unknown',
];

// English UI labels for each status.
export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  interested: 'Interested',
  hot: 'Hot',
  cold: 'Cold',
  enrolled: 'Enrolled',
  unknown: 'Unknown',
};

/**
 * Tailwind badge classes per status, following the brief's color mapping:
 * new→blue, interested→orange, hot→green, cold→grey, enrolled→purple,
 * unknown→amber. Full literal strings so Tailwind's scanner keeps them.
 */
export const STATUS_BADGE_CLASSES: Record<LeadStatus, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  interested: 'bg-orange-50 text-orange-700 border-orange-200',
  hot: 'bg-green-50 text-green-700 border-green-200',
  cold: 'bg-gray-100 text-gray-600 border-gray-300',
  enrolled: 'bg-purple-50 text-purple-700 border-purple-200',
  unknown: 'bg-amber-50 text-amber-700 border-amber-200',
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === 'string' && (LEAD_STATUSES as string[]).includes(value);
}

/** Coerce an arbitrary value into a valid status, defaulting to 'unknown'. */
export function coerceStatus(value: unknown): LeadStatus {
  return isLeadStatus(value) ? value : 'unknown';
}
