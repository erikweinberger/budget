import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expenses, expenseSplits } from '@/lib/db/schema';
import { createEvenSplits } from '@/lib/auto-split';

type PreviewSplit = {
  userId: number;
  splitMode: string;
  amount: string;
  percentage?: string | null;
};

type ImportRow = {
  date: string;
  title: string;
  rawDescription?: string;
  amount: string;
  categoryId?: number | null;
  name?: string | null;
  paidByUserId?: number | null;
  splits?: PreviewSplit[] | null;
};

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  const { expenses: rows, boardId, paidByUserId } = await request.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No expenses to import' }, { status: 400 });
  }

  const globalPayer = paidByUserId ?? userId;

  const inserted = await db
    .insert(expenses)
    .values(
      rows.map((r: ImportRow) => ({
        date: r.date,
        title: r.title,
        rawDescription: r.rawDescription ?? null,
        amount: String(r.amount),
        categoryId: r.categoryId ?? null,
        boardId: boardId ?? null,
        paidByUserId: r.paidByUserId ?? globalPayer,
        name: r.name ?? null,
        source: 'upload',
      }))
    )
    .returning();

  if (boardId) {
    await Promise.all(
      inserted.map((e, i) => {
        const row = rows[i] as ImportRow;
        const rowPayer = row.paidByUserId ?? globalPayer;

        if (row.splits && row.splits.length > 0) {
          // Use pre-configured splits; mark payer's split as resolved
          return db.insert(expenseSplits).values(
            row.splits.map((s) => ({
              expenseId: e.id,
              userId: s.userId,
              splitMode: s.splitMode,
              amount: s.amount,
              percentage: s.percentage ?? null,
              resolved: s.userId === rowPayer,
            }))
          );
        }

        // Fall back to automatic even split
        return createEvenSplits(e.id, boardId, e.amount, rowPayer);
      })
    );
  }

  return NextResponse.json({ imported: inserted.length });
}
