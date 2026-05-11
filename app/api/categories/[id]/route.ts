import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { categories, expenses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, color, defaultSplitType, defaultSplitRatio } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (color !== undefined) updates.color = color;
  if (defaultSplitType !== undefined) updates.defaultSplitType = defaultSplitType;
  if (defaultSplitRatio !== undefined) updates.defaultSplitRatio = defaultSplitRatio;

  const [updated] = await db
    .update(categories)
    .set(updates)
    .where(eq(categories.id, Number(id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const catId = Number(id);

  // Find the "Other" category to reassign expenses
  const [other] = await db.query.categories.findMany({
    where: (c, { eq }) => eq(c.isDefault, true),
    limit: 1,
  });

  if (other) {
    await db.update(expenses).set({ categoryId: other.id }).where(eq(expenses.categoryId, catId));
  }

  await db.delete(categories).where(eq(categories.id, catId));
  return NextResponse.json({ ok: true });
}
