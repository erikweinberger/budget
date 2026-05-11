import { db } from '@/lib/db';
import { boardMembers, expenseSplits } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function createEvenSplits(
  expenseId: number,
  boardId: number,
  amount: string,
  paidByUserId?: number | null,
) {
  const members = await db.query.boardMembers.findMany({
    where: eq(boardMembers.boardId, boardId),
  });
  if (members.length < 2) return;

  const total = parseFloat(amount);
  const perPerson = total / members.length;
  const base = Math.floor(perPerson * 100) / 100;
  const remainder = Math.round((total - base * members.length) * 100);

  await db.insert(expenseSplits).values(
    members.map((m, i) => ({
      expenseId,
      userId: m.userId,
      splitMode: 'even',
      amount: (base + (i < remainder ? 0.01 : 0)).toFixed(2),
      // Payer's own split is auto-resolved since they already paid
      resolved: paidByUserId != null ? m.userId === paidByUserId : false,
    }))
  );
}
