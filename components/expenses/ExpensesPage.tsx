'use client';

import { useEffect, useState, useCallback } from 'react';
import KanbanView from './KanbanView';
import ListView from './ListView';
import UploadModal from './UploadModal';
import ManualAddModal from './ManualAddModal';
import EditExpenseModal from './EditExpenseModal';
import SplitModal from './SplitModal';
import { useBoard } from '@/lib/board-context';

export interface Category {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
  keywords: { id: number; keyword: string }[];
}

export interface ExpenseSplit {
  id: number;
  userId: number;
  splitMode: string;
  amount: string | null;
  percentage: string | null;
  resolved: boolean;
  user: { id: number; username: string };
}

export interface Expense {
  id: number;
  date: string;
  title: string;
  amount: string;
  categoryId: number | null;
  boardId: number | null;
  paidByUserId: number | null;
  paidBy?: { id: number; username: string } | null;
  name?: string | null;
  source: string;
  category?: Category | null;
  splits?: ExpenseSplit[];
}

export default function ExpensesPage() {
  const { activeBoard } = useBoard();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [splitTarget, setSplitTarget] = useState<Expense | null>(null);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [settlementFilter, setSettlementFilter] = useState<'unresolved' | 'resolved' | 'all'>('unresolved');
  const [resolving, setResolving] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setCurrentUserId(d.userId));
  }, []);

  const loadCategories = useCallback(async () => {
    const r = await fetch('/api/categories');
    setCategories(await r.json());
  }, []);

  const loadExpenses = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeBoard) params.set('boardId', String(activeBoard.id));
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const r = await fetch(`/api/expenses?${params}`);
    setExpenses(await r.json());
  }, [activeBoard, from, to]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  async function updateCategory(expenseId: number, categoryId: number) {
    await fetch(`/api/expenses/${expenseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId }),
    });
    setExpenses((prev) => prev.map((e) => (e.id === expenseId ? { ...e, categoryId } : e)));
  }

  async function updateExpense(expenseId: number, patch: Partial<Expense>) {
    await fetch(`/api/expenses/${expenseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setExpenses((prev) => prev.map((e) => (e.id === expenseId ? { ...e, ...patch } : e)));
  }

  async function deleteExpense(expenseId: number) {
    await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
  }

  async function resolveExpense(expenseId: number) {
    setResolving(expenseId);
    await fetch(`/api/expenses/${expenseId}/resolve`, { method: 'POST' });
    await loadExpenses();
    setResolving(null);
  }

  async function resolveAll() {
    if (!activeBoard) return;
    setResolving(-1);
    await fetch(`/api/boards/${activeBoard.id}/resolve-all`, { method: 'POST' });
    await loadExpenses();
    setResolving(null);
  }

  function isFullySettled(e: Expense) {
    if (!e.splits || e.splits.length === 0) return true;
    return e.splits.every(s => s.resolved);
  }

  if (!activeBoard) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-2xl font-bold text-white mb-2">No board selected</p>
        <p className="text-gray-400 text-sm">Create a board using the sidebar to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 flex-shrink-0 flex-wrap">
        <h1 className="text-xl font-bold text-white mr-1">Expenses</h1>
        <span className="text-gray-600 text-sm">·</span>
        <span className="text-gray-400 text-sm">{activeBoard.name}</span>

        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="text-gray-500 text-sm">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="flex-1" />

        {settlementFilter === 'unresolved' && (
          <button
            onClick={resolveAll}
            disabled={resolving === -1}
            className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
          >
            {resolving === -1 ? 'Resolving...' : 'Resolve all'}
          </button>
        )}

        <div className="flex bg-gray-800 rounded-lg p-0.5 gap-0.5">
          {(['unresolved', 'all', 'resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setSettlementFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${settlementFilter === f ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex bg-gray-800 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setView('kanban')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'kanban' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Board
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            List
          </button>
        </div>

        <button onClick={() => setShowManual(true)} className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          + Manual
        </button>
        <button onClick={() => setShowUpload(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          + Upload
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {(() => {
          const visibleExpenses = currentUserId === null ? expenses : expenses.filter(e => {
            const settled = isFullySettled(e);
            if (settlementFilter === 'resolved') return settled;
            if (settlementFilter === 'unresolved') return !settled;
            return true;
          });
          return view === 'kanban' ? (
            <KanbanView
              expenses={visibleExpenses}
              categories={categories}
              onUpdateCategory={updateCategory}
              onOpenSplit={setSplitTarget}
              onEdit={setEditTarget}
              onResolve={resolveExpense}
              resolvingId={resolving}
              currentUserId={currentUserId}
            />
          ) : (
            <ListView
              expenses={visibleExpenses}
              categories={categories}
              onUpdateExpense={updateExpense}
              onDeleteExpense={deleteExpense}
              onOpenSplit={setSplitTarget}
              onEdit={setEditTarget}
              onResolve={resolveExpense}
              resolvingId={resolving}
              currentUserId={currentUserId}
            />
          );
        })()}
      </div>

      {showUpload && (
        <UploadModal
          categories={categories}
          boardId={activeBoard.id}
          members={activeBoard.members}
          currentUserId={currentUserId}
          onClose={() => setShowUpload(false)}
          onImported={() => { setShowUpload(false); loadExpenses(); }}
        />
      )}

      {showManual && (
        <ManualAddModal
          categories={categories}
          boardId={activeBoard.id}
          members={activeBoard.members}
          currentUserId={currentUserId}
          onClose={() => setShowManual(false)}
          onAdded={() => { setShowManual(false); loadExpenses(); }}
        />
      )}

      {splitTarget && activeBoard.members.length > 0 && (
        <SplitModal
          expenseId={splitTarget.id}
          expenseAmount={splitTarget.amount}
          expenseTitle={splitTarget.title}
          members={activeBoard.members}
          onClose={() => setSplitTarget(null)}
          onSaved={() => { setSplitTarget(null); loadExpenses(); }}
        />
      )}

      {editTarget && (
        <EditExpenseModal
          expense={editTarget}
          categories={categories}
          members={activeBoard.members}
          currentUserId={currentUserId}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); loadExpenses(); }}
        />
      )}
    </div>
  );
}
