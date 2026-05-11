'use client';

import { useState, useEffect } from 'react';
import type { BoardMember } from '@/lib/board-context';

type SplitMode = 'solo' | 'even' | 'percentage' | 'amount';

interface SplitRow {
  userId: number;
  username: string;
  amount: string;
  percentage: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);
}

export default function SplitModal({
  expenseId,
  expenseAmount,
  expenseTitle,
  members,
  onClose,
  onSaved,
}: {
  expenseId: number;
  expenseAmount: string;
  expenseTitle: string;
  members: BoardMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const total = parseFloat(expenseAmount);
  const [mode, setMode] = useState<SplitMode>('even');
  const [soloUserId, setSoloUserId] = useState<number>(members[0]?.userId ?? 0);
  const [rows, setRows] = useState<SplitRow[]>(() =>
    members.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      amount: (total / members.length).toFixed(2),
      percentage: (100 / members.length).toFixed(2),
    }))
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Recalculate even split when mode changes
  useEffect(() => {
    if (mode === 'even') {
      const even = (total / members.length).toFixed(2);
      const evenPct = (100 / members.length).toFixed(2);
      setRows(members.map((m) => ({ userId: m.userId, username: m.user.username, amount: even, percentage: evenPct })));
    }
  }, [mode, members, total]);

  function updateRow(userId: number, field: 'amount' | 'percentage', value: string) {
    setRows((prev) => prev.map((r) => r.userId === userId ? { ...r, [field]: value } : r));
  }

  function validate(): string {
    if (mode === 'percentage') {
      const sum = rows.reduce((s, r) => s + parseFloat(r.percentage || '0'), 0);
      if (Math.abs(sum - 100) > 0.01) return `Percentages sum to ${sum.toFixed(2)}% — must be 100%`;
    }
    if (mode === 'amount') {
      const sum = rows.reduce((s, r) => s + parseFloat(r.amount || '0'), 0);
      if (Math.abs(sum - total) > 0.01) return `Amounts sum to ${fmt(sum)} — must equal ${fmt(total)}`;
    }
    return '';
  }

  async function save() {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');

    let splits;
    if (mode === 'solo') {
      splits = [{ userId: soloUserId, splitMode: 'solo', amount: expenseAmount }];
    } else if (mode === 'even') {
      splits = rows.map((r) => ({ userId: r.userId, splitMode: 'even', amount: r.amount }));
    } else if (mode === 'percentage') {
      splits = rows.map((r) => ({
        userId: r.userId,
        splitMode: 'percentage',
        percentage: r.percentage,
        amount: ((parseFloat(r.percentage) / 100) * total).toFixed(2),
      }));
    } else {
      splits = rows.map((r) => ({ userId: r.userId, splitMode: 'amount', amount: r.amount }));
    }

    const r = await fetch(`/api/expenses/${expenseId}/splits`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ splits }),
    });

    if (!r.ok) {
      const d = await r.json();
      setError(d.error ?? 'Failed to save');
    } else {
      onSaved();
    }
    setSaving(false);
  }

  const MODES: { value: SplitMode; label: string; description: string }[] = [
    { value: 'even', label: 'Even split', description: `${fmt(total / members.length)} each` },
    { value: 'percentage', label: 'By percentage', description: 'Assign % to each person' },
    { value: 'amount', label: 'By amount', description: 'Assign $ to each person' },
    { value: 'solo', label: 'Solo', description: 'One person pays in full' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">Split expense</h2>
            <p className="text-sm text-gray-400 mt-0.5 truncate max-w-xs">{expenseTitle} · {fmt(total)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  mode === m.value
                    ? 'border-indigo-500 bg-indigo-900/30 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                }`}
              >
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
              </button>
            ))}
          </div>

          {/* Solo: pick one user */}
          {mode === 'solo' && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Who pays?</p>
              <div className="space-y-1">
                {members.map((m) => (
                  <label key={m.userId} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-800">
                    <input
                      type="radio"
                      name="solo-user"
                      checked={soloUserId === m.userId}
                      onChange={() => setSoloUserId(m.userId)}
                      className="accent-indigo-500"
                    />
                    <span className="text-white text-sm">{m.user.username}</span>
                    {soloUserId === m.userId && (
                      <span className="ml-auto text-sm text-white font-medium">{fmt(total)}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Even: show preview */}
          {mode === 'even' && (
            <div className="space-y-1">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50">
                  <span className="text-white text-sm">{m.user.username}</span>
                  <span className="text-gray-300 text-sm font-medium">{fmt(total / members.length)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Percentage */}
          {mode === 'percentage' && (
            <div className="space-y-2">
              {rows.map((r) => {
                const amt = (parseFloat(r.percentage || '0') / 100) * total;
                return (
                  <div key={r.userId} className="flex items-center gap-3">
                    <span className="text-white text-sm w-24 truncate">{r.username}</span>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={r.percentage}
                        onChange={(e) => updateRow(r.userId, 'percentage', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-7 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                    </div>
                    <span className="text-gray-400 text-sm w-20 text-right">{fmt(amt)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between pt-1 border-t border-gray-800 text-xs">
                <span className="text-gray-500">Total</span>
                <span className={Math.abs(rows.reduce((s, r) => s + parseFloat(r.percentage || '0'), 0) - 100) > 0.01 ? 'text-red-400' : 'text-green-400'}>
                  {rows.reduce((s, r) => s + parseFloat(r.percentage || '0'), 0).toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* Amount */}
          {mode === 'amount' && (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.userId} className="flex items-center gap-3">
                  <span className="text-white text-sm w-24 truncate">{r.username}</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={r.amount}
                      onChange={(e) => updateRow(r.userId, 'amount', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pl-7 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-1 border-t border-gray-800 text-xs">
                <span className="text-gray-500">Total</span>
                <span className={Math.abs(rows.reduce((s, r) => s + parseFloat(r.amount || '0'), 0) - total) > 0.01 ? 'text-red-400' : 'text-green-400'}>
                  {fmt(rows.reduce((s, r) => s + parseFloat(r.amount || '0'), 0))} / {fmt(total)}
                </span>
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm py-2.5 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save split'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
