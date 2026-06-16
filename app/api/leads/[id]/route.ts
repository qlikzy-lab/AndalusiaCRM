import { NextRequest, NextResponse } from 'next/server';
import {
  updateLeadFields,
  deleteLead,
  dtoToDomainLead,
  type LeadEditableFields,
} from '@/lib/leadRepo';
import { pushToCRM } from '@/lib/crm';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  let body: LeadEditableFields;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  try {
    const updated = await updateLeadFields(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }
    try {
      await pushToCRM(dtoToDomainLead(updated));
    } catch {
      // Best-effort CRM sync; ignored for the placeholder.
    }
    return NextResponse.json({ lead: updated });
  } catch {
    return NextResponse.json({ error: 'Could not update the lead.' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const ok = await deleteLead(id);
  if (!ok) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
