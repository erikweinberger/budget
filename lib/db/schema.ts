import { pgTable, serial, text, numeric, date, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const boards = pgTable('boards', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdByUserId: integer('created_by_user_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const boardMembers = pgTable('board_members', {
  id: serial('id').primaryKey(),
  boardId: integer('board_id').references(() => boards.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').default('member').notNull(), // 'owner' | 'member'
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6B7280'),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const categoryKeywords = pgTable('category_keywords', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'cascade' }).notNull(),
  keyword: text('keyword').notNull(),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  title: text('title').notNull(),
  rawDescription: text('raw_description'),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  boardId: integer('board_id').references(() => boards.id, { onDelete: 'cascade' }),
  paidByUserId: integer('paid_by_user_id').references(() => users.id),
  name: text('name'),
  source: text('source').default('manual').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Split modes: 'solo' | 'even' | 'percentage' | 'amount'
export const expenseSplits = pgTable('expense_splits', {
  id: serial('id').primaryKey(),
  expenseId: integer('expense_id').references(() => expenses.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  splitMode: text('split_mode').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }),
  percentage: numeric('percentage', { precision: 5, scale: 2 }),
  resolved: boolean('resolved').default(false).notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  boardMembers: many(boardMembers),
  expenseSplits: many(expenseSplits),
  createdBoards: many(boards),
  paidExpenses: many(expenses),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  createdBy: one(users, { fields: [boards.createdByUserId], references: [users.id] }),
  members: many(boardMembers),
  expenses: many(expenses),
}));

export const boardMembersRelations = relations(boardMembers, ({ one }) => ({
  board: one(boards, { fields: [boardMembers.boardId], references: [boards.id] }),
  user: one(users, { fields: [boardMembers.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  keywords: many(categoryKeywords),
  expenses: many(expenses),
}));

export const categoryKeywordsRelations = relations(categoryKeywords, ({ one }) => ({
  category: one(categories, { fields: [categoryKeywords.categoryId], references: [categories.id] }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  category: one(categories, { fields: [expenses.categoryId], references: [categories.id] }),
  board: one(boards, { fields: [expenses.boardId], references: [boards.id] }),
  paidBy: one(users, { fields: [expenses.paidByUserId], references: [users.id] }),
  splits: many(expenseSplits),
}));

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, { fields: [expenseSplits.expenseId], references: [expenses.id] }),
  user: one(users, { fields: [expenseSplits.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Board = typeof boards.$inferSelect;
export type BoardMember = typeof boardMembers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type CategoryKeyword = typeof categoryKeywords.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;
