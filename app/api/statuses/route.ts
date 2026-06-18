import { NextRequest, NextResponse } from 'next/server';
import { listCustomStatuses, createCustomStatus } from '@/lib/customStatusRepo';

export const runtime = 'nodejs';

export async function GET() {
  const statuses = await listCustomStatuses();
  return NextResponse.json({ statuses });
}

export async function POST(req: NextRequest) {
  let body: { label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const label = (body.label ?? '').trim();
  if (!label) {
    return NextResponse.json({ error: 'Label is required.' }, { status: 400 });
  }

  try {
    const status = await createCustomStatus(label);
    return NextResponse.json({ status }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'A status with that name already exists.' }, { status: 409 });
  }
}
