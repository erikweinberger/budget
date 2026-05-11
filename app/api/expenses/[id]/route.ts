import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expenses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const allowed = ['categoryId', 'splitType', 'splitRatio', 'title', 'amount', 'date', 'name', 'paidByUserId'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const [updated] = await db
    .update(expenses)
    .set(updates)
    .where(eq(expenses.id, Number(id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(expenses).where(eq(expenses.id, Number(id)));
  return NextResponse.json({ ok: true });
}
