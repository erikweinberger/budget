import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expenses } from '@/lib/db/schema';
import { createEvenSplits } from '@/lib/auto-split';

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  const { expenses: rows, boardId, paidByUserId } = await request.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No expenses to import' }, { status: 400 });
  }

  const payer = paidByUserId ?? userId;

  const inserted = await db
    .insert(expenses)
    .values(
      rows.map((r: { date: string; title: string; rawDescription?: string; amount: string; categoryId?: number | null; name?: string | null }) => ({
        date: r.date,
        title: r.title,
        rawDescription: r.rawDescription ?? null,
        amount: String(r.amount),
        categoryId: r.categoryId ?? null,
        boardId: boardId ?? null,
        paidByUserId: payer,
        name: r.name ?? null,
        source: 'upload',
      }))
    )
    .returning();

  if (boardId) {
    await Promise.all(inserted.map((e) => createEvenSplits(e.id, boardId, e.amount, payer)));
  }

  return NextResponse.json({ imported: inserted.length });
}
