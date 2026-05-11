'use client';

import { useState } from 'react';
import type { Category, Expense } from './ExpensesPage';

function fmt(amount: string) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(amount));
}

function splitSummary(expense: Expense): string {
  if (!expense.splits || expense.splits.length === 0) return '—';
  const first = expense.splits[0];
  if (first.splitMode === 'solo') {
    return `Solo · ${first.user.username}`;
  }
  if (first.splitMode === 'even') {
    return `Even · ${expense.splits.length} people`;
  }
  return `Split · ${expense.splits.length} people`;
}

export default function ListView({
  expenses,
  categories,
  onUpdateExpense,
  onDeleteExpense,
  onOpenSplit,
  onEdit,
  onResolve,
  resolvingId,
  currentUserId,
}: {
  expenses: Expense[];
  categories: Category[];
  onUpdateExpense: (id: number, patch: Partial<Expense>) => void;
  onDeleteExpense: (id: number) => void;
  onOpenSplit: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onResolve: (id: number) => void;
  resolvingId: number | null;
  currentUserId: number | null;
}) {
  const [sortCol, setSortCol] = useState<'date' | 'amount' | 'title' | 'category'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir(col === 'date' || col === 'amount' ? 'desc' : 'asc');
    }
  }

  function sortIndicator(col: typeof sortCol) {
    if (sortCol !== col) return <span className="text-gray-700">↕</span>;
    return <span className="text-gray-400">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  }

  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));

  const sorted = [...expenses].sort((a, b) => {
    let cmp = 0;
    if (sortCol === 'date') {
      cmp = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    } else if (sortCol === 'amount') {
      cmp = parseFloat(a.amount) - parseFloat(b.amount);
    } else if (sortCol === 'title') {
      cmp = a.title.localeCompare(b.title);
    } else if (sortCol === 'category') {
      const aName = (a.categoryId ? catById[a.categoryId]?.name : null) ?? '';
      const bName = (b.categoryId ? catById[b.categoryId]?.name : null) ?? '';
      cmp = aName.localeCompare(bName);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-950 border-b border-gray-800 z-10">
          <tr>
            <th className="text-left px-5 py-3 text-gray-400 font-medium">
              <button onClick={() => handleSort('date')} className="flex items-center gap-1 hover:text-white transition-colors">
                Date {sortIndicator('date')}
              </button>
            </th>
            <th className="text-left px-5 py-3 text-gray-400 font-medium">
              <button onClick={() => handleSort('title')} className="flex items-center gap-1 hover:text-white transition-colors">
                Title {sortIndicator('title')}
              </button>
            </th>
            <th className="text-right px-5 py-3 text-gray-400 font-medium">
              <button onClick={() => handleSort('amount')} className="flex items-center justify-end gap-1 w-full hover:text-white transition-colors">
                Amount {sortIndicator('amount')}
              </button>
            </th>
            <th className="text-left px-5 py-3 text-gray-400 font-medium">
              <button onClick={() => handleSort('category')} className="flex items-center gap-1 hover:text-white transition-colors">
                Category {sortIndicator('category')}
              </button>
            </th>
            <th className="text-left px-5 py-3 text-gray-400 font-medium">Split</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((expense) => (
            <tr
              key={expense.id}
              className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors"
            >
              <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{expense.date}</td>
              <td className="px-5 py-3 max-w-xs">
                <p className="text-white truncate">{expense.title}</p>
                {expense.name && <p className="text-gray-500 text-xs mt-0.5 truncate">{expense.name}</p>}
              </td>
              <td className="px-5 py-3 text-right font-medium text-white whitespace-nowrap">
                {fmt(expense.amount)}
              </td>
              <td className="px-5 py-3">
                <select
                  value={expense.categoryId ?? ''}
                  onChange={(e) =>
                    onUpdateExpense(expense.id, { categoryId: Number(e.target.value) || null })
                  }
                  className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">— none —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => onOpenSplit(expense)} className="flex items-center gap-1.5 text-xs group">
                    {expense.splits && expense.splits.length > 0 ? (
                      <span className="bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded group-hover:bg-indigo-800/60 transition-colors">
                        {splitSummary(expense)}
                      </span>
                    ) : (
                      <span className="text-gray-600 group-hover:text-indigo-400 transition-colors">+ Split</span>
                    )}
                  </button>
                  {(() => {
                    if (!expense.splits?.length || currentUserId === null) return null;
                    const mySplit = expense.splits.find(s => s.userId === currentUserId);
                    if (!mySplit || mySplit.resolved) return null;
                    if (expense.paidByUserId === currentUserId) return null; // payer doesn't resolve their own
                    return (
                      <button
                        onClick={() => onResolve(expense.id)}
                        disabled={resolvingId === expense.id}
                        className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-2 py-0.5 rounded transition-colors"
                      >
                        {resolvingId === expense.id ? '...' : 'Mark paid'}
                      </button>
                    );
                  })()}
                </div>
              </td>
              <td className="px-5 py-3 text-right">
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => onEdit(expense)}
                    className="text-gray-600 hover:text-indigo-400 transition-colors text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteExpense(expense.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xs"
                  >
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {expenses.length === 0 && (
        <p className="text-center text-gray-500 py-20">
          No expenses. Upload a statement or add manually.
        </p>
      )}
    </div>
  );
}
