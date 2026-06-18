import { NextRequest, NextResponse } from 'next/server';
import { deleteCustomStatus } from '@/lib/customStatusRepo';

export const runtime = 'nodejs';

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const ok = await deleteCustomStatus(id);
  if (!ok) return NextResponse.json({ error: 'Status not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
