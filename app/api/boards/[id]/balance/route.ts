import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expenseSplits, expenses } from '@/lib/db/schema';
import { and, eq, ne } from 'drizzle-orm';

export interface BalanceEntry {
  userId: number;
  username: string;
  /** Positive = they owe me; negative = I owe them */
  net: number;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  const { id } = await params;
  const boardId = Number(id);

  // All expenses on this board with their splits
  const boardExpenses = await db.query.expenses.findMany({
    where: and(eq(expenses.boardId, boardId)),
    with: { splits: { with: { user: true } }, paidBy: true },
  });

  // Net balance per other user
  const netByUser = new Map<number, { username: string; net: number }>();

  function ensure(uid: number, username: string) {
    if (!netByUser.has(uid)) netByUser.set(uid, { username, net: 0 });
  }

  for (const expense of boardExpenses) {
    if (!expense.paidByUserId) continue;

    for (const split of expense.splits) {
      if (split.resolved) continue;
      if (split.userId === expense.paidByUserId) continue; // payer's own split

      const amount = parseFloat(split.amount ?? '0');

      if (expense.paidByUserId === userId) {
        // I paid — other person owes me
        ensure(split.userId, split.user.username);
        netByUser.get(split.userId)!.net += amount;
      } else if (split.userId === userId) {
        // Someone else paid — I owe them
        ensure(expense.paidByUserId, expense.paidBy!.username);
        netByUser.get(expense.paidByUserId)!.net -= amount;
      }
    }
  }

  const entries: BalanceEntry[] = Array.from(netByUser.entries())
    .filter(([, v]) => Math.abs(v.net) > 0.001)
    .map(([uid, v]) => ({ userId: uid, username: v.username, net: v.net }));

  return NextResponse.json(entries);
}
