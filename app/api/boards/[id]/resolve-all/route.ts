import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expenseSplits, expenses } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  const { id } = await params;
  const boardId = Number(id);

  // Find all expense IDs in this board
  const boardExpenses = await db.query.expenses.findMany({
    where: eq(expenses.boardId, boardId),
    columns: { id: true },
  });
  const expenseIds = boardExpenses.map((e) => e.id);
  if (!expenseIds.length) return NextResponse.json({ ok: true });

  await db
    .update(expenseSplits)
    .set({ resolved: true })
    .where(
      and(
        inArray(expenseSplits.expenseId, expenseIds),
        eq(expenseSplits.userId, userId),
      )
    );

  return NextResponse.json({ ok: true });
}
