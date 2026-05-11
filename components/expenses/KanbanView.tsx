'use client';

import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import type { Category, Expense } from './ExpensesPage';

function fmt(amount: string) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(amount));
}

function ExpenseCard({
  expense,
  isDragging = false,
  onOpenSplit,
  onEdit,
  onResolve,
  resolvingId,
  currentUserId,
}: {
  expense: Expense;
  isDragging?: boolean;
  onOpenSplit?: (expense: Expense) => void;
  onEdit?: (expense: Expense) => void;
  onResolve?: (id: number) => void;
  resolvingId?: number | null;
  currentUserId?: number | null;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: expense.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined;

  const hasSplits = expense.splits && expense.splits.length > 0;
  const mySplit = currentUserId != null ? expense.splits?.find(s => s.userId === currentUserId) : null;
  const canResolve = mySplit != null && !mySplit.resolved && expense.paidByUserId !== currentUserId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`bg-gray-800 border border-gray-700 rounded-xl p-3 select-none transition-shadow ${
        isDragging ? 'opacity-50' : 'hover:border-gray-600 hover:shadow-lg'
      }`}
    >
      <div
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-white text-sm font-medium leading-snug line-clamp-2">{expense.title}</p>
          <p className="text-white font-semibold text-sm whitespace-nowrap">{fmt(expense.amount)}</p>
        </div>
        <p className="text-gray-500 text-xs mt-1">{expense.date}{expense.name && <span className="ml-2 text-gray-600">{expense.name}</span>}</p>
      </div>
      <div className="flex items-center justify-between mt-2">
        {hasSplits ? (
          <span className="text-xs bg-indigo-900/60 text-indigo-300 px-1.5 py-0.5 rounded">
            Split · {expense.splits!.length}p
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          {canResolve && onResolve && (
            <button
              onClick={(e) => { e.stopPropagation(); onResolve(expense.id); }}
              disabled={resolvingId === expense.id}
              className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-1.5 py-0.5 rounded transition-colors"
            >
              {resolvingId === expense.id ? '...' : 'Paid'}
            </button>
          )}
          {onOpenSplit && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenSplit(expense); }}
              className="text-xs text-gray-500 hover:text-indigo-400 transition-colors px-1.5 py-0.5 rounded hover:bg-indigo-900/30"
            >
              {hasSplits ? 'Split' : '+ Split'}
            </button>
          )}
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(expense); }}
              className="text-xs text-gray-600 hover:text-gray-300 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-700/50"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  category,
  expenses,
  onOpenSplit,
  onEdit,
  onResolve,
  resolvingId,
  currentUserId,
}: {
  category: Category & { total: number };
  expenses: Expense[];
  onOpenSplit: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onResolve: (id: number) => void;
  resolvingId: number | null;
  currentUserId: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: category.id });

  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: category.color }} />
        <span className="text-sm font-semibold text-white truncate">{category.name}</span>
        <span className="text-xs text-gray-500 ml-auto">
          {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(category.total)}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded-xl p-2 space-y-2 overflow-y-auto transition-colors ${
          isOver ? 'bg-indigo-900/20 ring-2 ring-indigo-500/50' : 'bg-gray-900/50'
        }`}
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        {[...expenses].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).map((expense) => (
          <ExpenseCard key={expense.id} expense={expense} onOpenSplit={onOpenSplit} onEdit={onEdit} onResolve={onResolve} resolvingId={resolvingId} currentUserId={currentUserId} />
        ))}
        {expenses.length === 0 && (
          <p className="text-center text-gray-600 text-xs py-8">Drop here</p>
        )}
      </div>
    </div>
  );
}

export default function KanbanView({
  expenses,
  categories,
  onUpdateCategory,
  onOpenSplit,
  onEdit,
  onResolve,
  resolvingId,
  currentUserId,
}: {
  expenses: Expense[];
  categories: Category[];
  onUpdateCategory: (expenseId: number, categoryId: number) => void;
  onOpenSplit: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onResolve: (id: number) => void;
  resolvingId: number | null;
  currentUserId: number | null;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const activeExpense = expenses.find((e) => e.id === activeId);

  // Deduplicate categories by name (in case seed ran twice), keeping lowest id per name
  const seenNames = new Map<string, Category>();
  for (const cat of [...categories].sort((a, b) => a.id - b.id)) {
    if (!seenNames.has(cat.name)) seenNames.set(cat.name, cat);
  }
  const dedupedCategories = Array.from(seenNames.values());

  // Map every duplicate category id → canonical id so expenses still show up
  const idToCanonical = new Map<number, number>();
  for (const cat of categories) {
    const canonical = seenNames.get(cat.name)!;
    idToCanonical.set(cat.id, canonical.id);
  }

  const defaultCat = dedupedCategories.find((c) => c.isDefault);

  const expensesByCategory = dedupedCategories.reduce<Record<number, Expense[]>>((acc, cat) => {
    acc[cat.id] = expenses.filter((e) => {
      const resolvedId = e.categoryId !== null ? (idToCanonical.get(e.categoryId) ?? e.categoryId) : null;
      return resolvedId === cat.id || (resolvedId === null && cat.isDefault);
    });
    return acc;
  }, {});

  const categoriesWithTotals = dedupedCategories.map((cat) => ({
    ...cat,
    total: (expensesByCategory[cat.id] ?? []).reduce((s, e) => s + parseFloat(e.amount), 0),
  }));

  // Show default category first
  const sorted = [
    ...categoriesWithTotals.filter((c) => c.isDefault),
    ...categoriesWithTotals.filter((c) => !c.isDefault),
  ];

  function handleDragStart(e: DragStartEvent) {
    setActiveId(Number(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const expenseId = Number(active.id);
    const categoryId = Number(over.id);
    onUpdateCategory(expenseId, categoryId);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 p-6 h-full overflow-x-auto">
        {sorted.map((cat) => (
          <KanbanColumn
            key={cat.id}
            category={cat}
            expenses={expensesByCategory[cat.id] ?? []}
            onOpenSplit={onOpenSplit}
            onEdit={onEdit}
            onResolve={onResolve}
            resolvingId={resolvingId}
            currentUserId={currentUserId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeExpense ? (
          <div className="w-64 rotate-2 opacity-90">
            <ExpenseCard expense={activeExpense} isDragging onOpenSplit={onOpenSplit} onEdit={onEdit} onResolve={onResolve} resolvingId={resolvingId} currentUserId={currentUserId} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
