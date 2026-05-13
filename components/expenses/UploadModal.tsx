'use client';

import { useState, useRef } from 'react';
import type { Category } from './ExpensesPage';
import type { BoardMember } from '@/lib/board-context';
import PreviewSplitModal, { type PreviewSplitEntry } from './PreviewSplitModal';

interface ParsedExpense {
  date: string;
  title: string;
  rawDescription: string;
  amount: string;
  categoryId: number | null;
  name?: string | null;
  paidByUserId?: number | null;
  splits?: PreviewSplitEntry[] | null;
}

function fmt(amount: string) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(amount));
}

export default function UploadModal({
  categories,
  boardId,
  members,
  currentUserId,
  onClose,
  onImported,
}: {
  categories: Category[];
  boardId: number;
  members: BoardMember[];
  currentUserId: number | null;
  onClose: () => void;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedExpense[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editedExpenses, setEditedExpenses] = useState<ParsedExpense[]>([]);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [globalPayer, setGlobalPayer] = useState<string>('');
  const [splitRowIndex, setSplitRowIndex] = useState<number | null>(null);

  const effectiveGlobalPayer = globalPayer || String(currentUserId ?? '');

  function applyDateFilter(expenses: ParsedExpense[], from: string, to: string) {
    return expenses.filter((e) => {
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      return true;
    });
  }

  async function handleFile(file: File) {
    setLoading(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    const r = await fetch('/api/expenses/upload', { method: 'POST', body: form });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error ?? 'Parse failed');
    } else {
      const filtered = applyDateFilter(data.expenses, filterFrom, filterTo);
      // Pre-fill paidByUserId from the name field if it matches a member
      const withPayer = filtered.map((e: ParsedExpense) => {
        if (!e.name || members.length === 0) return e;
        const match = members.find((m) =>
          m.user.username.toLowerCase().includes(e.name!.toLowerCase().split(' ').pop()!) ||
          e.name!.toLowerCase().includes(m.user.username.toLowerCase())
        );
        return { ...e, paidByUserId: match ? match.userId : Number(effectiveGlobalPayer) || null };
      });
      setParsed(data.expenses);
      setEditedExpenses(withPayer);
    }
    setLoading(false);
  }

  // When global payer changes, update all rows that haven't been individually changed
  function handleGlobalPayerChange(newPayer: string) {
    setGlobalPayer(newPayer);
    setEditedExpenses((prev) => prev.map((e) => ({ ...e, paidByUserId: Number(newPayer) || null })));
  }

  async function importAll() {
    setLoading(true);
    const r = await fetch('/api/expenses/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenses: editedExpenses,
        boardId,
        paidByUserId: effectiveGlobalPayer ? Number(effectiveGlobalPayer) : null,
      }),
    });
    if (r.ok) {
      onImported();
    } else {
      const d = await r.json();
      setError(d.error ?? 'Import failed');
    }
    setLoading(false);
  }

  function updateRow(i: number, patch: Partial<ParsedExpense>) {
    setEditedExpenses((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function removeRow(i: number) {
    setEditedExpenses((prev) => prev.filter((_, idx) => idx !== i));
  }

  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Upload Statement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {!parsed ? (
            <>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="text-sm text-gray-400">Filter by date:</span>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-gray-500 text-sm">to</span>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-gray-500 text-xs">(optional)</span>

                {members.length > 0 && (
                  <>
                    <span className="text-gray-600 text-sm">·</span>
                    <span className="text-sm text-gray-400">Default paid by:</span>
                    <select
                      value={effectiveGlobalPayer}
                      onChange={(e) => setGlobalPayer(e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.user.username}{m.userId === currentUserId ? ' (you)' : ''}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <div
                className="border-2 border-dashed border-gray-700 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-500 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
              >
                <p className="text-gray-300 text-base mb-2">Drop your PDF or CSV here</p>
                <p className="text-gray-500 text-sm">or click to browse</p>
                <p className="text-gray-600 text-xs mt-3">Supports: Westpac PDF, CSV exports</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                {loading && <p className="text-indigo-400 mt-4">Parsing...</p>}
                {error && <p className="text-red-400 mt-4">{error}</p>}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <p className="text-gray-300 text-sm">
                    Found <span className="text-white font-semibold">{editedExpenses.length}</span> expenses.
                    Review and adjust before importing.
                  </p>
                  {members.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Set all paid by:</span>
                      <select
                        value={effectiveGlobalPayer}
                        onChange={(e) => handleGlobalPayerChange(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {members.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.user.username}{m.userId === currentUserId ? ' (you)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setParsed(null); setEditedExpenses([]); }}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Upload different file
                </button>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Title</th>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Name</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">Amount</th>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Category</th>
                    {members.length > 0 && <th className="text-left py-2 px-3 text-gray-400 font-medium">Paid by</th>}
                    {members.length > 0 && <th className="text-left py-2 px-3 text-gray-400 font-medium">Split</th>}
                    <th className="py-2 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {editedExpenses.map((expense, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 px-3 text-gray-400 whitespace-nowrap text-xs">{expense.date}</td>
                      <td className="py-2 px-3 text-white max-w-xs truncate text-xs" title={expense.title}>
                        {expense.title}
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">
                        {expense.name ?? '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-white text-xs whitespace-nowrap">
                        {fmt(expense.amount)}
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={expense.categoryId ?? ''}
                          onChange={(e) => updateRow(i, { categoryId: Number(e.target.value) || null })}
                          className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1"
                          style={{
                            borderLeftColor: expense.categoryId ? catById[expense.categoryId]?.color : '#6B7280',
                            borderLeftWidth: 3,
                          }}
                        >
                          <option value="">— none —</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      {members.length > 0 && (
                        <td className="py-2 px-3">
                          <select
                            value={expense.paidByUserId ?? effectiveGlobalPayer}
                            onChange={(e) => updateRow(i, { paidByUserId: Number(e.target.value) || null })}
                            className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1"
                          >
                            {members.map((m) => (
                              <option key={m.userId} value={m.userId}>
                                {m.user.username}{m.userId === currentUserId ? ' (you)' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      {members.length > 0 && (
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setSplitRowIndex(i)}
                            className={`text-xs px-2 py-0.5 rounded transition-colors ${
                              expense.splits
                                ? 'bg-indigo-900/60 text-indigo-300 hover:bg-indigo-800/60'
                                : 'text-gray-500 hover:text-indigo-400'
                            }`}
                          >
                            {expense.splits
                              ? expense.splits.length === 1
                                ? `Solo · ${members.find(m => m.userId === expense.splits![0].userId)?.user.username ?? '?'}`
                                : `${expense.splits[0].splitMode === 'even' ? 'Even' : 'Custom'} · ${expense.splits.length}p`
                              : '+ Split'}
                          </button>
                        </td>
                      )}
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => removeRow(i)}
                          className="text-gray-600 hover:text-red-400 text-xs"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {splitRowIndex !== null && editedExpenses[splitRowIndex] && (
          <PreviewSplitModal
            expenseTitle={editedExpenses[splitRowIndex].title}
            expenseAmount={editedExpenses[splitRowIndex].amount}
            members={members}
            initial={editedExpenses[splitRowIndex].splits}
            onConfirm={(splits) => {
              updateRow(splitRowIndex, { splits });
              setSplitRowIndex(null);
            }}
            onClose={() => setSplitRowIndex(null)}
          />
        )}

        {parsed && (
          <div className="flex items-center justify-between p-5 border-t border-gray-800">
            <p className="text-sm text-gray-400">
              Importing <span className="text-white">{editedExpenses.length}</span> expenses
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="text-sm text-gray-400 hover:text-white px-4 py-2">
                Cancel
              </button>
              <button
                onClick={importAll}
                disabled={loading || editedExpenses.length === 0}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-6 py-2 rounded-lg transition-colors"
              >
                {loading ? 'Importing...' : `Import ${editedExpenses.length} expenses`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
