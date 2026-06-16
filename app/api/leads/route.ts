import { NextRequest, NextResponse } from 'next/server';
import {
  listLeads,
  createLeadFromPrepared,
  updateLeadFromPrepared,
  dtoToDomainLead,
} from '@/lib/leadRepo';
import { pushToCRM } from '@/lib/crm';
import type { LeadDTO, SaveRequest, SaveSummary } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const leads = await listLeads();
    return NextResponse.json({ leads });
  } catch {
    return NextResponse.json({ error: 'Could not load leads.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: SaveRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const newLeads = Array.isArray(body.newLeads) ? body.newLeads : [];
  const decisions = Array.isArray(body.decisions) ? body.decisions : [];

  const summary: SaveSummary = { created: 0, updated: 0, skipped: 0 };
  const saved: LeadDTO[] = [];

  // Write to the database. If this fails, surface an error and save nothing more
  // so the review screen can stay intact.
  try {
    for (const lead of newLeads) {
      saved.push(await createLeadFromPrepared(lead));
      summary.created += 1;
    }
    for (const decision of decisions) {
      if (decision.action === 'skip') {
        summary.skipped += 1;
      } else if (decision.action === 'new') {
        saved.push(await createLeadFromPrepared(decision.incoming));
        summary.created += 1;
      } else if (decision.action === 'update') {
        saved.push(await updateLeadFromPrepared(decision.existingId, decision.incoming));
        summary.updated += 1;
      }
    }
  } catch {
    return NextResponse.json({ error: 'Could not save leads to the database.' }, { status: 500 });
  }

  // Push each saved lead to the CRM placeholder (best-effort — a CRM failure
  // does not undo the database save).
  for (const dto of saved) {
    try {
      await pushToCRM(dtoToDomainLead(dto));
    } catch {
      // Intentionally ignored for the placeholder; real CRM errors would be logged here.
    }
  }

  return NextResponse.json({ summary });
}
