import { NextRequest, NextResponse } from 'next/server';
import { parseWestpacPDF } from '@/lib/parsers/westpac-pdf';
import { parseCSV } from '@/lib/parsers/csv';
import { categorize } from '@/lib/categorizer';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get('file') as File | null;
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

  return NextResponse.json({ expenses: categorized, count: categorized.length });
}
