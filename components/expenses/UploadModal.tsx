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
  isDuplicate?: boolean;
}

function fmt(amount: string) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(amount));
}

function ExpenseRow({
  expense,
  index,
  members,
  categories,
  currentUserId,
  effectiveGlobalPayer,
  catById,
  onUpdate,
  onRemove,
  onSplit,
  splitControl,
}: {
  expense: ParsedExpense;
  index: number;
  members: BoardMember[];
  categories: Category[];
  currentUserId: number | null;
  effectiveGlobalPayer: string;
  catById: Record<number, Category>;
  onUpdate: (patch: Partial<ParsedExpense>) => void;
  onRemove: () => void;
  onSplit: () => void;
  splitControl?: React.ReactNode;
}) {
  return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
      <td className="py-2 px-3 text-gray-400 whitespace-nowrap text-xs">{expense.date}</td>
      <td className="py-2 px-3 text-white max-w-xs truncate text-xs" title={expense.title}>{expense.title}</td>
      <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">{expense.name ?? '—'}</td>
      <td className="py-2 px-3 text-right text-white text-xs whitespace-nowrap">{fmt(expense.amount)}</td>
      <td className="py-2 px-3">
        <select
          value={expense.categoryId ?? ''}
          onChange={(e) => onUpdate({ categoryId: Number(e.target.value) || null })}
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
            onChange={(e) => onUpdate({ paidByUserId: Number(e.target.value) || null })}
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
            onClick={onSplit}
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
      {splitControl !== undefined && <td className="py-2 px-3">{splitControl}</td>}
      <td className="py-2 px-3 text-right">
        <button onClick={onRemove} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
      </td>
    </tr>
  );
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
  // Indices into editedExpenses that are duplicates the user opted to include
  const [includedDupIndices, setIncludedDupIndices] = useState<Set<number>>(new Set());
  const [showDuplicates, setShowDuplicates] = useState(true);
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
    try {
      const { parseFileClient } = await import('@/lib/parsers/client-parser');
      const raw = await parseFileClient(file);

      if (raw.length === 0) {
        setError('No transactions found in this file.');
        setLoading(false);
        return;
      }

      const transactions = raw.map((t) => ({
        date: t.date,
        title: t.description.replace(/\s+[A-Z\s]+\s+AUS\s*$/i, '').replace(/\s+AUS\s*$/i, '').trim(),
        rawDescription: t.description,
        amount: t.amount,
        name: t.name ?? null,
      }));

      const r = await fetch('/api/expenses/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, boardId }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? 'Parse failed');
      } else {
        const filtered = applyDateFilter(data.expenses, filterFrom, filterTo);
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
        setIncludedDupIndices(new Set());
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to parse file');
    }
    setLoading(false);
  }

  function handleGlobalPayerChange(newPayer: string) {
    setGlobalPayer(newPayer);
    setEditedExpenses((prev) => prev.map((e) => ({ ...e, paidByUserId: Number(newPayer) || null })));
  }

  function updateRow(i: number, patch: Partial<ParsedExpense>) {
    setEditedExpenses((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function removeRow(i: number) {
    setEditedExpenses((prev) => prev.filter((_, idx) => idx !== i));
    setIncludedDupIndices((prev) => {
      const next = new Set(prev);
      next.delete(i);
      return next;
    });
  }

  function toggleDuplicate(i: number) {
    setIncludedDupIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  const newRows = editedExpenses.map((e, i) => ({ e, i })).filter(({ e }) => !e.isDuplicate);
  const dupRows = editedExpenses.map((e, i) => ({ e, i })).filter(({ e }) => e.isDuplicate);
  const importCount = newRows.length + includedDupIndices.size;

  async function importAll() {
    setLoading(true);
    const toImport = [
      ...newRows.map(({ e }) => e),
      ...dupRows.filter(({ i }) => includedDupIndices.has(i)).map(({ e }) => e),
    ];
    const r = await fetch('/api/expenses/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenses: toImport,
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

  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));

  const tableHeaders = (
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
  );

  const dupTableHeaders = (
    <tr className="border-b border-amber-900/40">
      <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
      <th className="text-left py-2 px-3 text-gray-400 font-medium">Title</th>
      <th className="text-left py-2 px-3 text-gray-400 font-medium">Name</th>
      <th className="text-right py-2 px-3 text-gray-400 font-medium">Amount</th>
      <th className="text-left py-2 px-3 text-gray-400 font-medium">Category</th>
      {members.length > 0 && <th className="text-left py-2 px-3 text-gray-400 font-medium">Paid by</th>}
      {members.length > 0 && <th className="text-left py-2 px-3 text-gray-400 font-medium">Split</th>}
      <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs">Include</th>
      <th className="py-2 px-3" />
    </tr>
  );

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
                <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-gray-500 text-sm">to</span>
                <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-gray-500 text-xs">(optional)</span>
                {members.length > 0 && (
                  <>
                    <span className="text-gray-600 text-sm">·</span>
                    <span className="text-sm text-gray-400">Default paid by:</span>
                    <select value={effectiveGlobalPayer} onChange={(e) => setGlobalPayer(e.target.value)}
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
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <p className="text-gray-300 text-base mb-2">Drop your PDF or CSV here</p>
                <p className="text-gray-500 text-sm">or click to browse</p>
                <p className="text-gray-600 text-xs mt-3">Supports: Westpac PDF, CSV exports</p>
                <input ref={fileRef} type="file" accept=".pdf,.csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
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
                    <span className="text-white font-semibold">{newRows.length}</span> new
                    {dupRows.length > 0 && <span className="text-amber-400"> · {dupRows.length} possible duplicate{dupRows.length !== 1 ? 's' : ''}</span>}
                  </p>
                  {members.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Set all paid by:</span>
                      <select value={effectiveGlobalPayer} onChange={(e) => handleGlobalPayerChange(e.target.value)}
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
                <button onClick={() => { setParsed(null); setEditedExpenses([]); }} className="text-xs text-gray-500 hover:text-gray-300">
                  Upload different file
                </button>
              </div>

              {/* New expenses */}
              {newRows.length > 0 && (
                <table className="w-full text-sm mb-6">
                  <thead>{tableHeaders}</thead>
                  <tbody>
                    {newRows.map(({ e, i }) => (
                      <ExpenseRow
                        key={i}
                        expense={e}
                        index={i}
                        members={members}
                        categories={categories}
                        currentUserId={currentUserId}
                        effectiveGlobalPayer={effectiveGlobalPayer}
                        catById={catById}
                        onUpdate={(patch) => updateRow(i, patch)}
                        onRemove={() => removeRow(i)}
                        onSplit={() => setSplitRowIndex(i)}
                      />
                    ))}
                  </tbody>
                </table>
              )}

              {/* Duplicates section */}
              {dupRows.length > 0 && (
                <div className="border border-amber-900/40 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowDuplicates((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-amber-950/30 hover:bg-amber-950/50 transition-colors"
                  >
                    <span className="text-amber-400 text-sm font-medium">
                      {dupRows.length} possible duplicate{dupRows.length !== 1 ? 's' : ''} — already exist in this board
                    </span>
                    <span className="text-amber-600 text-xs">{showDuplicates ? '▲ hide' : '▼ show'}</span>
                  </button>

                  {showDuplicates && (
                    <table className="w-full text-sm">
                      <thead>{dupTableHeaders}</thead>
                      <tbody>
                        {dupRows.map(({ e, i }) => (
                          <ExpenseRow
                            key={i}
                            expense={e}
                            index={i}
                            members={members}
                            categories={categories}
                            currentUserId={currentUserId}
                            effectiveGlobalPayer={effectiveGlobalPayer}
                            catById={catById}
                            onUpdate={(patch) => updateRow(i, patch)}
                            onRemove={() => removeRow(i)}
                            onSplit={() => setSplitRowIndex(i)}
                            splitControl={
                              <input
                                type="checkbox"
                                checked={includedDupIndices.has(i)}
                                onChange={() => toggleDuplicate(i)}
                                className="accent-amber-500 w-4 h-4 cursor-pointer"
                              />
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {splitRowIndex !== null && editedExpenses[splitRowIndex] && (
          <PreviewSplitModal
            expenseTitle={editedExpenses[splitRowIndex].title}
            expenseAmount={editedExpenses[splitRowIndex].amount}
            members={members}
            initial={editedExpenses[splitRowIndex].splits}
            onConfirm={(splits) => { updateRow(splitRowIndex, { splits }); setSplitRowIndex(null); }}
            onClose={() => setSplitRowIndex(null)}
          />
        )}

        {parsed && (
          <div className="flex items-center justify-between p-5 border-t border-gray-800">
            <p className="text-sm text-gray-400">
              Importing <span className="text-white">{importCount}</span> expense{importCount !== 1 ? 's' : ''}
              {includedDupIndices.size > 0 && <span className="text-amber-400"> (incl. {includedDupIndices.size} duplicate{includedDupIndices.size !== 1 ? 's' : ''})</span>}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="text-sm text-gray-400 hover:text-white px-4 py-2">Cancel</button>
              <button
                onClick={importAll}
                disabled={loading || importCount === 0}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-6 py-2 rounded-lg transition-colors"
              >
                {loading ? 'Importing...' : `Import ${importCount} expense${importCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
