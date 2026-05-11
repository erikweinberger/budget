import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expenses } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { createEvenSplits } from '@/lib/auto-split';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const categoryId = searchParams.get('category');
  const boardId = searchParams.get('boardId');

  const conditions = [];
  if (boardId) conditions.push(eq(expenses.boardId, Number(boardId)));
  if (from) conditions.push(sql`${expenses.date} >= ${from}::date`);
  if (to) conditions.push(sql`${expenses.date} <= ${to}::date`);
  if (categoryId) conditions.push(eq(expenses.categoryId, Number(categoryId)));

  const rows = await db.query.expenses.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    with: { category: true, splits: { with: { user: true } }, paidBy: true },
    orderBy: (e, { desc }) => [desc(e.date), desc(e.createdAt)],
  });

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  const body = await request.json();
  const { date, title, amount, categoryId, boardId, paidByUserId, name } = body;

  if (!date || !title || amount === undefined) {
    return NextResponse.json({ error: 'date, title, and amount are required' }, { status: 400 });
  }

  const payer = paidByUserId ?? userId;

  const [expense] = await db
    .insert(expenses)
    .values({
      date,
      title,
      amount: String(amount),
      categoryId: categoryId ?? null,
      boardId: boardId ?? null,
      paidByUserId: payer,
      name: name ?? null,
      source: 'manual',
    })
    .returning();

  if (boardId) {
    await createEvenSplits(expense.id, boardId, expense.amount, payer);
  }

  return NextResponse.json(expense, { status: 201 });
}
