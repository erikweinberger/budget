import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { boards } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(boards).where(eq(boards.id, Number(id)));
  return NextResponse.json({ ok: true });
}
