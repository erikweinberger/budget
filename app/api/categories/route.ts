import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { categories, categoryKeywords } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const cats = await db.query.categories.findMany({
    with: { keywords: true },
    orderBy: (c, { asc }) => [asc(c.isDefault), asc(c.name)],
  });
  return NextResponse.json(cats);
}

export async function POST(request: NextRequest) {
  const { name, color } = await request.json();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const [cat] = await db
    .insert(categories)
    .values({ name, color: color ?? '#6B7280' })
    .returning();

  return NextResponse.json(cat, { status: 201 });
}
