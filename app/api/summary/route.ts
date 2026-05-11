import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expenses } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  const { searchParams } = request.nextUrl;
  const month = searchParams.get('month');
  const boardId = searchParams.get('boardId');

  const now = new Date();
  const year = month ? month.split('-')[0] : String(now.getFullYear());
  const mon = month ? month.split('-')[1] : String(now.getMonth() + 1).padStart(2, '0');
  const from = `${year}-${mon}-01`;
  const lastDay = new Date(Number(year), Number(mon), 0).getDate();
  const to = `${year}-${mon}-${lastDay}`;

  const conditions = [
    sql`${expenses.date} >= ${from}::date`,
    sql`${expenses.date} <= ${to}::date`,
  ];
  if (boardId) conditions.push(eq(expenses.boardId, Number(boardId)));

  const rows = await db.query.expenses.findMany({
    where: and(...conditions),
    with: { category: true, splits: true },
  });

  // For each expense, use the current user's split amount if one exists,
  // otherwise use the full expense amount.
  const byCategory = new Map<
    string,
    { categoryId: number | null; categoryName: string | null; categoryColor: string | null; total: number; count: number }
  >();

  for (const expense of rows) {
    const userSplit = expense.splits.find((s) => s.userId === userId);
    const amount = userSplit
      ? parseFloat(userSplit.amount ?? '0')
      : parseFloat(expense.amount);

    const key = String(expense.categoryId ?? '');
    if (!byCategory.has(key)) {
      byCategory.set(key, {
        categoryId: expense.categoryId,
        categoryName: expense.category?.name ?? null,
        categoryColor: expense.category?.color ?? null,
        total: 0,
        count: 0,
      });
    }
    const row = byCategory.get(key)!;
    row.total += amount;
    row.count += 1;
  }

  const byCategoryArr = Array.from(byCategory.values());
  const grandTotal = byCategoryArr.reduce((s, r) => s + r.total, 0);

  return NextResponse.json({ from, to, grandTotal, byCategory: byCategoryArr });
}
