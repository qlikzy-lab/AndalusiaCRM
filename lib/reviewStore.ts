import type { DedupResult } from './types';

// Carries the extraction + dedup result from the upload screen to the review
// screen via sessionStorage. Nothing is persisted to the database until the
// user confirms on the review screen.
const KEY = 'andalusia.review.v1';

export interface ReviewPayload {
  result: DedupResult;
  filenames: string[];
  raw: string;
  mock?: boolean;
}

export function saveReview(payload: ReviewPayload): void {
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function loadReview(): ReviewPayload | null {
  try {
    const stored = sessionStorage.getItem(KEY);
    return stored ? (JSON.parse(stored) as ReviewPayload) : null;
  } catch {
    return null;
  }
}

export function clearReview(): void {
  sessionStorage.removeItem(KEY);
}
