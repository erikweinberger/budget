import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expenseSplits, expenses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const splits = await db.query.expenseSplits.findMany({
    where: eq(expenseSplits.expenseId, Number(id)),
    with: { user: true },
  });
  return NextResponse.json(splits);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expenseId = Number(id);
  const { splits } = await request.json() as {
    splits: { userId: number; splitMode: string; amount?: string; percentage?: string }[]
  };

  if (!splits?.length) return NextResponse.json({ error: 'splits required' }, { status: 400 });

  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

  const mode = splits[0].splitMode;
  if (mode === 'percentage') {
    const total = splits.reduce((s, r) => s + parseFloat(r.percentage ?? '0'), 0);
    if (Math.abs(total - 100) > 0.01) {
      return NextResponse.json({ error: 'Percentages must sum to 100' }, { status: 400 });
    }
  }
  if (mode === 'amount') {
    const total = splits.reduce((s, r) => s + parseFloat(r.amount ?? '0'), 0);
    if (Math.abs(total - parseFloat(expense.amount)) > 0.01) {
      return NextResponse.json({ error: `Amounts must sum to ${expense.amount}` }, { status: 400 });
    }
  }

  await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
  const inserted = await db
    .insert(expenseSplits)
    .values(splits.map((s) => ({
      expenseId,
      userId: s.userId,
      splitMode: s.splitMode,
      amount: s.amount ?? null,
      percentage: s.percentage ?? null,
      // Payer's split is always resolved
      resolved: expense.paidByUserId != null ? s.userId === expense.paidByUserId : false,
    })))
    .returning();

  return NextResponse.json(inserted);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, Number(id)));
  return NextResponse.json({ ok: true });
}
