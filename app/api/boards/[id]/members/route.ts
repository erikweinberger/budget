import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { boardMembers, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const members = await db.query.boardMembers.findMany({
    where: eq(boardMembers.boardId, Number(id)),
    with: { user: true },
  });
  return NextResponse.json(members);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { username } = await request.json();
  if (!username) return NextResponse.json({ error: 'Username required' }, { status: 400 });

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const existing = await db.query.boardMembers.findFirst({
    where: and(eq(boardMembers.boardId, Number(id)), eq(boardMembers.userId, user.id)),
  });
  if (existing) return NextResponse.json({ error: 'Already a member' }, { status: 409 });

  const [member] = await db
    .insert(boardMembers)
    .values({ boardId: Number(id), userId: user.id, role: 'member' })
    .returning();

  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await request.json();
  await db
    .delete(boardMembers)
    .where(and(eq(boardMembers.boardId, Number(id)), eq(boardMembers.userId, Number(userId))));
  return NextResponse.json({ ok: true });
}
