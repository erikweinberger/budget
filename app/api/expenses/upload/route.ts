import { NextRequest, NextResponse } from 'next/server';
import { categorize } from '@/lib/categorizer';
import { db } from '@/lib/db';
import { expenses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

function dupKey(date: string, amount: string, title: string) {
  return `${date}|${parseFloat(amount).toFixed(2)}|${title.toLowerCase().trim()}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { transactions, boardId } = body as {
    transactions: { date?: string; title: string; rawDescription: string; amount: string; name?: string | null }[];
    boardId?: number | null;
  };

  if (!Array.isArray(transactions)) {
    return NextResponse.json({ error: 'transactions array required' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];

  const parsed = transactions.map((t) => ({
    date: t.date || today,
    title: t.title,
    rawDescription: t.rawDescription,
    amount: t.amount,
    name: t.name ?? null,
  }));

  const categorized = await categorize(parsed);

  const existingKeys = new Set<string>();
  if (boardId) {
    const existing = await db
      .select({ date: expenses.date, amount: expenses.amount, title: expenses.title })
      .from(expenses)
      .where(eq(expenses.boardId, boardId));
    for (const e of existing) existingKeys.add(dupKey(e.date, e.amount, e.title));
  }

  const withDupFlag = categorized.map((e) => ({
    ...e,
    isDuplicate: existingKeys.has(dupKey(e.date, e.amount, e.title)),
  }));

  return NextResponse.json({ expenses: withDupFlag, count: withDupFlag.length });
}
