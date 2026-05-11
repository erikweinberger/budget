import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expenseSplits } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  const { id } = await params;

  await db
    .update(expenseSplits)
    .set({ resolved: true })
    .where(and(eq(expenseSplits.expenseId, Number(id)), eq(expenseSplits.userId, userId)));

  return NextResponse.json({ ok: true });
}
