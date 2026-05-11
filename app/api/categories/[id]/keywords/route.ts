import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { categoryKeywords } from '@/lib/db/schema';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { keyword } = await request.json();
  if (!keyword) return NextResponse.json({ error: 'Keyword required' }, { status: 400 });

  const [kw] = await db
    .insert(categoryKeywords)
    .values({ categoryId: Number(id), keyword: keyword.toUpperCase() })
    .returning();

  return NextResponse.json(kw, { status: 201 });
}
