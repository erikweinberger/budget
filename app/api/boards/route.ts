import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { boards, boardMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));

  // Return boards the current user is a member of
  const memberships = await db.query.boardMembers.findMany({
    where: eq(boardMembers.userId, userId),
    with: { board: { with: { members: { with: { user: true } } } } },
  });

  return NextResponse.json(memberships.map((m) => m.board));
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const [board] = await db
    .insert(boards)
    .values({ name: name.trim(), createdByUserId: userId })
    .returning();

  // Creator is automatically an owner member
  await db.insert(boardMembers).values({ boardId: board.id, userId, role: 'owner' });

  return NextResponse.json(board, { status: 201 });
}
