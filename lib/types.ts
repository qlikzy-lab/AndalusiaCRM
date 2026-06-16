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

/** A saved lead serialized for the client (dates as ISO strings, filenames parsed). */
export interface LeadDTO {
  id: string;
  phoneNumber: string | null;
  phoneNumberNormalized: string | null;
  displayName: string | null;
  childName: string | null;
  childAge: string | null;
  notes: string;
  status: LeadStatus;
  source: LeadSource;
  screenshotFilenames: string[];
  firstSeenAt: string;
  lastUpdatedAt: string;
  rawExtraction: string;
}

/**
 * An extracted lead prepared for review and saving: phone normalized, source
 * derived, given a client-side id, and editable on the review screen.
 */
export interface PreparedLead {
  tempId: string;
  phoneNumber: string | null;
  phoneNumberNormalized: string | null;
  displayName: string | null;
  childName: string | null;
  childAge: string | null;
  notes: string;
  status: LeadStatus;
  source: LeadSource;
  confidence: Confidence;
  screenshotFilenames: string[];
  rawExtraction: string;
}

export type DuplicateAction = 'skip' | 'update' | 'new';

export interface DuplicateMatch {
  incoming: PreparedLead;
  existing: LeadDTO;
  matchedOn: 'phone' | 'name';
  ambiguous: boolean; // matched more than one existing lead
}

export interface DedupResult {
  newLeads: PreparedLead[];
  duplicates: DuplicateMatch[];
  couldNotExtract: PreparedLead[];
}

export interface SaveDecision {
  incoming: PreparedLead;
  existingId: string;
  action: DuplicateAction;
}

export interface SaveRequest {
  newLeads: PreparedLead[];
  decisions: SaveDecision[];
}

export interface SaveSummary {
  created: number;
  updated: number;
  skipped: number;
}
