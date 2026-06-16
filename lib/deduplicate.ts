import { normalizePhone } from './normalize';
import type {
  ExtractedLead,
  PreparedLead,
  DuplicateMatch,
  DedupResult,
  LeadDTO,
  LeadStatus,
  LeadSource,
  ScreenshotType,
  Confidence,
} from './types';

// Most-engaged status wins when merging duplicates within a batch.
const STATUS_PRIORITY: Record<LeadStatus, number> = {
  enrolled: 5,
  hot: 4,
  interested: 3,
  new: 2,
  cold: 1,
  unknown: 0,
};

const CONFIDENCE_PRIORITY: Record<Confidence, number> = { high: 2, medium: 1, low: 0 };

function sourceFromType(type: ScreenshotType): LeadSource {
  return type === 'inbox' ? 'inbox_screenshot' : 'chat_screenshot';
}

/** Stable key used to detect the same person: normalized phone, else lowercased name. */
function dedupeKey(lead: Pick<PreparedLead, 'phoneNumberNormalized' | 'displayName'>): string | null {
  if (lead.phoneNumberNormalized) return `phone:${lead.phoneNumberNormalized}`;
  if (lead.displayName) return `name:${lead.displayName.trim().toLowerCase()}`;
  return null;
}

function toPrepared(lead: ExtractedLead, filenames: string[], raw: string): PreparedLead {
  const { normalized } = normalizePhone(lead.phoneNumber);
  return {
    tempId: crypto.randomUUID(),
    phoneNumber: lead.phoneNumber,
    phoneNumberNormalized: normalized,
    displayName: lead.displayName,
    childName: lead.childName,
    childAge: lead.childAge,
    notes: lead.notes,
    status: lead.status,
    source: sourceFromType(lead.screenshotType),
    confidence: lead.confidence,
    screenshotFilenames: filenames,
    rawExtraction: raw,
  };
}

function pick<T>(primary: T | null, fallback: T | null): T | null {
  return primary != null && primary !== '' ? primary : fallback;
}

/** Merge two within-batch entries for the same person. */
function mergePrepared(a: PreparedLead, b: PreparedLead): PreparedLead {
  const notes =
    a.notes && b.notes && a.notes !== b.notes ? `${a.notes} | ${b.notes}` : a.notes || b.notes;
  return {
    ...a,
    phoneNumber: pick(a.phoneNumber, b.phoneNumber),
    phoneNumberNormalized: pick(a.phoneNumberNormalized, b.phoneNumberNormalized),
    displayName: pick(a.displayName, b.displayName),
    childName: pick(a.childName, b.childName),
    childAge: pick(a.childAge, b.childAge),
    notes,
    status: STATUS_PRIORITY[a.status] >= STATUS_PRIORITY[b.status] ? a.status : b.status,
    confidence: CONFIDENCE_PRIORITY[a.confidence] >= CONFIDENCE_PRIORITY[b.confidence]
      ? a.confidence
      : b.confidence,
    screenshotFilenames: Array.from(
      new Set([...a.screenshotFilenames, ...b.screenshotFilenames]),
    ),
  };
}

/**
 * Categorize freshly extracted leads against the existing database.
 *
 * Order (per the brief):
 *  - low-confidence / unidentifiable extractions → couldNotExtract
 *  - collapse same-person entries within this batch
 *  - match remaining against the DB by normalized phone, else by display name
 *    (case-insensitive); >1 match flags the duplicate as ambiguous
 */
export function deduplicate(
  extracted: ExtractedLead[],
  existing: LeadDTO[],
  filenames: string[],
  raw: string,
): DedupResult {
  const couldNotExtract: PreparedLead[] = [];
  const candidates: PreparedLead[] = [];

  for (const lead of extracted) {
    const prepared = toPrepared(lead, filenames, raw);
    const noIdentifier = !prepared.phoneNumberNormalized && !prepared.displayName;
    if (lead.confidence === 'low' || noIdentifier) {
      couldNotExtract.push(prepared);
    } else {
      candidates.push(prepared);
    }
  }

  // Step 1 — collapse duplicates within this batch.
  const byKey = new Map<string, PreparedLead>();
  for (const candidate of candidates) {
    const key = dedupeKey(candidate);
    // candidates always have an identifier (else they'd be in couldNotExtract).
    const existingEntry = key ? byKey.get(key) : undefined;
    if (key) byKey.set(key, existingEntry ? mergePrepared(existingEntry, candidate) : candidate);
  }
  const batchUnique = [...byKey.values()];

  // Step 2 — compare against the database.
  const newLeads: PreparedLead[] = [];
  const duplicates: DuplicateMatch[] = [];

  for (const lead of batchUnique) {
    let matches: LeadDTO[] = [];
    let matchedOn: 'phone' | 'name' = 'phone';

    if (lead.phoneNumberNormalized) {
      matches = existing.filter(
        (e) => e.phoneNumberNormalized && e.phoneNumberNormalized === lead.phoneNumberNormalized,
      );
      matchedOn = 'phone';
    }
    if (matches.length === 0 && lead.displayName) {
      const name = lead.displayName.trim().toLowerCase();
      matches = existing.filter((e) => e.displayName && e.displayName.trim().toLowerCase() === name);
      matchedOn = 'name';
    }

    if (matches.length === 0) {
      newLeads.push(lead);
    } else {
      duplicates.push({
        incoming: lead,
        existing: matches[0],
        matchedOn,
        ambiguous: matches.length > 1,
      });
    }
  }

  return { newLeads, duplicates, couldNotExtract };
}
