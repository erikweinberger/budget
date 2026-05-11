'use client';

import { useEffect, useState, useCallback } from 'react';
import { useBoard } from '@/lib/board-context';
import type { Expense } from '@/components/expenses/ExpensesPage';

interface CategoryRow {
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  total: number;
  count: number;
}

interface Summary {
  from: string;
  to: string;
  grandTotal: number;
  byCategory: CategoryRow[];
}

interface BalanceEntry {
  userId: number;
  username: string;
  net: number;
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
}

export default function SummaryPage() {
  const { activeBoard, loading: boardLoading } = useBoard();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [balance, setBalance] = useState<BalanceEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<number | null>(null);
  const [settlementTab, setSettlementTab] = useState<'unresolved' | 'resolved'>('unresolved');

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setCurrentUserId(d.userId));
  }, []);

  const loadAll = useCallback(async () => {
    if (!activeBoard) return;
    setLoading(true);
    const [summaryRes, balanceRes, expensesRes] = await Promise.all([
      fetch(`/api/summary?month=${month}&boardId=${activeBoard.id}`),
      fetch(`/api/boards/${activeBoard.id}/balance`),
      fetch(`/api/expenses?boardId=${activeBoard.id}`),
    ]);
    setSummary(await summaryRes.json());
    setBalance(await balanceRes.json());
    setExpenses(await expensesRes.json());
    setLoading(false);
  }, [activeBoard, month]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function resolveExpense(expenseId: number) {
    setResolving(expenseId);
    await fetch(`/api/expenses/${expenseId}/resolve`, { method: 'POST' });
    await loadAll();
    setResolving(null);
  }

  async function resolveAll() {
    if (!activeBoard) return;
    setResolving(-1);
    await fetch(`/api/boards/${activeBoard.id}/resolve-all`, { method: 'POST' });
    await loadAll();
    setResolving(null);
  }

  if (boardLoading) return <div className="p-8 text-gray-500">Loading...</div>;

  if (!activeBoard) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-2xl font-bold text-white mb-2">No board selected</p>
        <p className="text-gray-400 text-sm">Create a board using the sidebar to get started.</p>
      </div>
    );
  }

  // Compute unresolved/resolved expense lists for current user
  function isFullySettled(e: Expense) {
    if (!e.splits || e.splits.length === 0) return true;
    const mySplit = e.splits.find(s => s.userId === currentUserId);
    if (!mySplit?.resolved) return false;
    if (e.paidByUserId === currentUserId) {
      return e.splits.every(s => s.resolved);
    }
    return true;
  }

  const unresolvedExpenses = expenses.filter(e => {
    if (!e.splits || e.splits.length === 0) return false;
    const mySplit = e.splits.find(s => s.userId === currentUserId);
    if (!mySplit) return false;
    return !isFullySettled(e);
  });

  const resolvedExpenses = expenses.filter(e => {
    if (!e.splits || e.splits.length === 0) return false;
    const mySplit = e.splits.find(s => s.userId === currentUserId);
    return mySplit != null && isFullySettled(e);
  });

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Summary</h1>
        <p className="text-gray-400 text-sm mt-1">
          {now.toLocaleString('en-AU', { month: 'long', year: 'numeric' })} · {activeBoard.name}
        </p>
      </div>

      {loading ? <div className="text-gray-500">Loading...</div> : (
        <>
          {/* Balance banner */}
          {balance.length > 0 && (
            <div className="space-y-2">
              {balance.map((entry) => (
                <div
                  key={entry.userId}
                  className={`rounded-xl px-5 py-4 flex items-center justify-between ${
                    entry.net > 0
                      ? 'bg-green-900/30 border border-green-800/50'
                      : 'bg-amber-900/30 border border-amber-800/50'
                  }`}
                >
                  <p className="text-sm text-gray-300">
                    {entry.net > 0
                      ? <><span className="font-semibold text-white">{entry.username}</span> owes you</>
                      : <>You owe <span className="font-semibold text-white">{entry.username}</span></>
                    }
                  </p>
                  <p className={`text-lg font-bold ${entry.net > 0 ? 'text-green-400' : 'text-amber-400'}`}>
                    {fmt(Math.abs(entry.net))}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Monthly spend */}
          {summary && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <p className="text-sm text-gray-400">Your share this month</p>
              <p className="text-4xl font-bold text-white mt-1">{fmt(summary.grandTotal)}</p>
            </div>
          )}

          {/* Category breakdown */}
          {summary && summary.byCategory.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-5 py-3 text-gray-400 font-medium">Category</th>
                    <th className="text-right px-5 py-3 text-gray-400 font-medium">Transactions</th>
                    <th className="text-right px-5 py-3 text-gray-400 font-medium">Your share</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byCategory
                    .sort((a, b) => b.total - a.total)
                    .map((row, i) => (
                      <tr key={i} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-3 text-white">
                          <span className="flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: row.categoryColor ?? '#6B7280' }} />
                            {row.categoryName ?? 'Uncategorized'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-400">{row.count}</td>
                        <td className="px-5 py-3 text-right font-medium text-white">{fmt(row.total)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Settlements */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex bg-gray-800 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setSettlementTab('unresolved')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${settlementTab === 'unresolved' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Unresolved {unresolvedExpenses.length > 0 && <span className="ml-1 bg-amber-600 text-white text-xs px-1.5 py-0.5 rounded-full">{unresolvedExpenses.length}</span>}
                </button>
                <button
                  onClick={() => setSettlementTab('resolved')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${settlementTab === 'resolved' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Resolved
                </button>
              </div>
              {settlementTab === 'unresolved' && unresolvedExpenses.length > 0 && (
                <button
                  onClick={resolveAll}
                  disabled={resolving === -1}
                  className="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
                >
                  {resolving === -1 ? 'Resolving...' : 'Resolve all'}
                </button>
              )}
            </div>

            {settlementTab === 'unresolved' ? (
              unresolvedExpenses.length === 0 ? (
                <p className="text-center text-gray-500 py-10 text-sm">All caught up! No unresolved payments.</p>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  {unresolvedExpenses.map((expense, i) => {
                    const mySplit = expense.splits!.find(s => s.userId === currentUserId)!;
                    const iOwed = expense.paidByUserId === currentUserId;
                    return (
                      <div key={expense.id} className={`flex items-center gap-4 px-5 py-4 ${i < unresolvedExpenses.length - 1 ? 'border-b border-gray-800' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{expense.title}</p>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {expense.date} · {iOwed
                              ? `${expense.splits!.filter(s => !s.resolved && s.userId !== currentUserId).map(s => s.user.username).join(', ')} owe${expense.splits!.filter(s => !s.resolved && s.userId !== currentUserId).length === 1 ? 's' : ''} you`
                              : `You owe ${expense.paidBy?.username}`
                            }
                          </p>
                        </div>
                        <p className={`font-semibold text-sm whitespace-nowrap ${iOwed ? 'text-green-400' : 'text-amber-400'}`}>
                          {fmt(parseFloat(mySplit.amount ?? '0'))}
                        </p>
                        {!iOwed && (
                          <button
                            onClick={() => resolveExpense(expense.id)}
                            disabled={resolving === expense.id}
                            className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {resolving === expense.id ? '...' : 'Mark paid'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              resolvedExpenses.length === 0 ? (
                <p className="text-center text-gray-500 py-10 text-sm">No resolved payments yet.</p>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  {resolvedExpenses.map((expense, i) => {
                    const mySplit = expense.splits!.find(s => s.userId === currentUserId)!;
                    return (
                      <div key={expense.id} className={`flex items-center gap-4 px-5 py-4 opacity-60 ${i < resolvedExpenses.length - 1 ? 'border-b border-gray-800' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{expense.title}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{expense.date}</p>
                        </div>
                        <p className="text-gray-400 text-sm font-medium">{fmt(parseFloat(mySplit.amount ?? '0'))}</p>
                        <span className="text-xs text-green-600">✓ Settled</span>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
