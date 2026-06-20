import { NextRequest, NextResponse } from 'next/server';
import { parseWestpacPDF } from '@/lib/parsers/westpac-pdf';
import { parseCSV } from '@/lib/parsers/csv';
import { categorize } from '@/lib/categorizer';
import { db } from '@/lib/db';
import { expenses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'edge';

function dupKey(date: string, amount: string, title: string) {
  return `${date}|${parseFloat(amount).toFixed(2)}|${title.toLowerCase().trim()}`;
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get('file') as File | null;
  const boardId = form.get('boardId') ? Number(form.get('boardId')) : null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  let rawTransactions;
  if (name.endsWith('.pdf')) {
    rawTransactions = await parseWestpacPDF(buffer);
  } else if (name.endsWith('.csv')) {
    rawTransactions = parseCSV(buffer.toString('utf-8'));
  } else {
    return NextResponse.json({ error: 'Unsupported file type. Upload a PDF or CSV.' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];

  const parsed = rawTransactions.map((t) => ({
    date: t.date || today,
    title: t.description.replace(/\s+[A-Z\s]+\s+AUS\s*$/i, '').replace(/\s+AUS\s*$/i, '').trim(),
    rawDescription: t.description,
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
