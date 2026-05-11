import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { categoryKeywords } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ keywordId: string }> }) {
  const { keywordId } = await params;
  await db.delete(categoryKeywords).where(eq(categoryKeywords.id, Number(keywordId)));
  return NextResponse.json({ ok: true });
}
