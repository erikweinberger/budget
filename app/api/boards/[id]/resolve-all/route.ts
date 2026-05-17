import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expenseSplits, expenses } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const boardId = Number(id);

  const boardExpenses = await db.query.expenses.findMany({
    where: eq(expenses.boardId, boardId),
    columns: { id: true },
  });
  const expenseIds = boardExpenses.map((e) => e.id);
  if (!expenseIds.length) return NextResponse.json({ ok: true });

  await db
    .update(expenseSplits)
    .set({ resolved: true })
    .where(inArray(expenseSplits.expenseId, expenseIds));

  return NextResponse.json({ ok: true });
}
