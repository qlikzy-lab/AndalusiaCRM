// Shared domain types for the lead ingestion tool.

export type LeadStatus =
  | 'new' // Just enquired, no real conversation yet
  | 'interested' // Engaged, asking questions, positive tone
  | 'hot' // Explicitly asked for visit, enrollment info, or next steps
  | 'cold' // Went quiet, one-word replies, or explicitly said not interested
  | 'enrolled' // Confirmed enrollment mentioned in conversation
  | 'unknown'; // Claude could not determine status confidently

export type ScreenshotType = 'inbox' | 'chat';

export type Confidence = 'high' | 'medium' | 'low';

export type LeadSource = 'inbox_screenshot' | 'chat_screenshot' | 'manual';

/**
 * One lead exactly as Claude returns it from a screenshot, before any
 * normalization or deduplication. Mirrors the JSON shape in lib/prompt.ts.
 */
export interface ExtractedLead {
  phoneNumber: string | null;
  displayName: string | null;
  childName: string | null;
  childAge: string | null;
  notes: string;
  status: LeadStatus;
  screenshotType: ScreenshotType;
  confidence: Confidence;
}

/**
 * Domain representation of a saved lead. `screenshotFilenames` is a real array
 * here (stored as a JSON string in SQLite) and dates are `Date` objects.
 */
export interface Lead {
  id: string;
  phoneNumber: string | null;
  displayName: string | null;
  childName: string | null;
  childAge: string | null;
  notes: string;
  status: LeadStatus;
  source: LeadSource;
  screenshotFilenames: string[];
  firstSeenAt: Date;
  lastUpdatedAt: Date;
  rawExtraction: string;
}
