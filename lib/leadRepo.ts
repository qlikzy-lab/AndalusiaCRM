import { Prisma, type Lead as PrismaLead } from '@prisma/client';
import { prisma } from './prisma';
import { normalizePhone } from './normalize';
import type { Lead, LeadDTO, LeadSource, PreparedLead } from './types';

function parseFilenames(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Serialize a DB row for the client (filenames parsed, dates as ISO strings). */
export function toLeadDTO(row: PrismaLead): LeadDTO {
  return {
    id: row.id,
    phoneNumber: row.phoneNumber,
    phoneNumberNormalized: row.phoneNumberNormalized,
    displayName: row.displayName,
    childName: row.childName,
    childAge: row.childAge,
    notes: row.notes,
    status: row.status,
    source: row.source as LeadSource,
    screenshotFilenames: parseFilenames(row.screenshotFilenames),
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastUpdatedAt: row.lastUpdatedAt.toISOString(),
    rawExtraction: row.rawExtraction,
  };
}

/** Convert a serialized lead back into the domain shape used by pushToCRM. */
export function dtoToDomainLead(dto: LeadDTO): Lead {
  return {
    ...dto,
    firstSeenAt: new Date(dto.firstSeenAt),
    lastUpdatedAt: new Date(dto.lastUpdatedAt),
  };
}

export async function listLeads(): Promise<LeadDTO[]> {
  const rows = await prisma.lead.findMany({ orderBy: { lastUpdatedAt: 'desc' } });
  return rows.map(toLeadDTO);
}

function preparedToCreateData(lead: PreparedLead) {
  const { normalized } = normalizePhone(lead.phoneNumber);
  return {
    phoneNumber: lead.phoneNumber,
    phoneNumberNormalized: normalized,
    displayName: lead.displayName,
    childName: lead.childName,
    childAge: lead.childAge,
    notes: lead.notes ?? '',
    status: lead.status,
    source: lead.source,
    screenshotFilenames: JSON.stringify(lead.screenshotFilenames ?? []),
    rawExtraction: lead.rawExtraction ?? '',
  };
}

export async function createLeadFromPrepared(lead: PreparedLead): Promise<LeadDTO> {
  const row = await prisma.lead.create({ data: preparedToCreateData(lead) });
  return toLeadDTO(row);
}

/**
 * Merge an extracted lead into an existing record, keeping its id. New non-empty
 * values win; notes and status are taken from the new extraction; filenames are
 * unioned. Falls back to creating the lead if the record no longer exists.
 */
export async function updateLeadFromPrepared(
  existingId: string,
  lead: PreparedLead,
): Promise<LeadDTO> {
  const existing = await prisma.lead.findUnique({ where: { id: existingId } });
  if (!existing) return createLeadFromPrepared(lead);

  const mergedFiles = Array.from(
    new Set([...parseFilenames(existing.screenshotFilenames), ...(lead.screenshotFilenames ?? [])]),
  );
  const { normalized } = normalizePhone(lead.phoneNumber ?? existing.phoneNumber);

  const row = await prisma.lead.update({
    where: { id: existingId },
    data: {
      phoneNumber: lead.phoneNumber ?? existing.phoneNumber,
      phoneNumberNormalized: normalized,
      displayName: lead.displayName ?? existing.displayName,
      childName: lead.childName ?? existing.childName,
      childAge: lead.childAge ?? existing.childAge,
      notes: lead.notes || existing.notes,
      status: lead.status,
      screenshotFilenames: JSON.stringify(mergedFiles),
    },
  });
  return toLeadDTO(row);
}

export interface LeadEditableFields {
  phoneNumber?: string | null;
  displayName?: string | null;
  childName?: string | null;
  childAge?: string | null;
  notes?: string;
  status?: string;
}

/** Update selected fields on an existing lead. Returns null if it doesn't exist. */
export async function updateLeadFields(
  id: string,
  fields: LeadEditableFields,
): Promise<LeadDTO | null> {
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return null;

  const data: Prisma.LeadUpdateInput = {};
  if ('phoneNumber' in fields) {
    data.phoneNumber = fields.phoneNumber ?? null;
    data.phoneNumberNormalized = normalizePhone(fields.phoneNumber ?? null).normalized;
  }
  if ('displayName' in fields) data.displayName = fields.displayName ?? null;
  if ('childName' in fields) data.childName = fields.childName ?? null;
  if ('childAge' in fields) data.childAge = fields.childAge ?? null;
  if (typeof fields.notes === 'string') data.notes = fields.notes;
  if ('status' in fields) data.status = fields.status;

  const row = await prisma.lead.update({ where: { id }, data });
  return toLeadDTO(row);
}

export async function deleteLead(id: string): Promise<boolean> {
  try {
    await prisma.lead.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
