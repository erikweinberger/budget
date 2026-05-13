'use client';

import { useState, useEffect } from 'react';
import type { BoardMember } from '@/lib/board-context';

export type SplitMode = 'solo' | 'even' | 'percentage' | 'amount';

export interface PreviewSplitEntry {
  userId: number;
  splitMode: SplitMode;
  amount: string;
  percentage: string | null;
}

interface SplitRow {
  userId: number;
  username: string;
  amount: string;
  percentage: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);
}

export default function PreviewSplitModal({
  expenseTitle,
  expenseAmount,
  members,
  initial,
  onConfirm,
  onClose,
}: {
  expenseTitle: string;
  expenseAmount: string;
  members: BoardMember[];
  initial?: PreviewSplitEntry[] | null;
  onConfirm: (splits: PreviewSplitEntry[]) => void;
  onClose: () => void;
}) {
  const total = parseFloat(expenseAmount);

  const [mode, setMode] = useState<SplitMode>(() => {
    if (!initial || initial.length === 0) return 'even';
    return initial[0].splitMode as SplitMode;
  });

  const [soloUserId, setSoloUserId] = useState<number>(() => {
    if (initial?.length === 1) return initial[0].userId;
    return members[0]?.userId ?? 0;
  });

  const [rows, setRows] = useState<SplitRow[]>(() =>
    members.map((m) => {
      const existing = initial?.find((s) => s.userId === m.userId);
      return {
        userId: m.userId,
        username: m.user.username,
        amount: existing?.amount ?? (total / members.length).toFixed(2),
        percentage: existing?.percentage ?? (100 / members.length).toFixed(2),
      };
    })
  );

  const [error, setError] = useState('');
  const [touched, setTouched] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (mode === 'even') {
      const even = (total / members.length).toFixed(2);
      const evenPct = (100 / members.length).toFixed(2);
      setRows(members.map((m) => ({ userId: m.userId, username: m.user.username, amount: even, percentage: evenPct })));
      setTouched(new Set());
    }
  }, [mode, members, total]);

  function updateRow(userId: number, field: 'amount' | 'percentage', value: string) {
    const newTouched = new Set(touched).add(userId);
    setTouched(newTouched);
    const numVal = parseFloat(value) || 0;

    setRows((prev) => {
      const untouched = prev.filter((r) => !newTouched.has(r.userId));
      if (field === 'amount') {
        const touchedSum = prev
          .filter((r) => newTouched.has(r.userId))
          .reduce((s, r) => s + (r.userId === userId ? numVal : parseFloat(r.amount || '0')), 0);
        const remaining = Math.max(0, total - touchedSum);
        const perUntouched = untouched.length > 0 ? remaining / untouched.length : 0;
        return prev.map((r) => {
          if (r.userId === userId) return { ...r, amount: value };
          if (!newTouched.has(r.userId)) return { ...r, amount: perUntouched.toFixed(2) };
          return r;
        });
      } else {
        const touchedSum = prev
          .filter((r) => newTouched.has(r.userId))
          .reduce((s, r) => s + (r.userId === userId ? numVal : parseFloat(r.percentage || '0')), 0);
        const remaining = Math.max(0, 100 - touchedSum);
        const perUntouched = untouched.length > 0 ? remaining / untouched.length : 0;
        return prev.map((r) => {
          if (r.userId === userId) return { ...r, percentage: value };
          if (!newTouched.has(r.userId)) return { ...r, percentage: perUntouched.toFixed(2) };
          return r;
        });
      }
    });
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

  function confirm() {
    const err = validate();
    if (err) { setError(err); return; }

    let splits: PreviewSplitEntry[];
    if (mode === 'solo') {
      splits = [{ userId: soloUserId, splitMode: 'solo', amount: expenseAmount, percentage: null }];
    } else if (mode === 'even') {
      splits = rows.map((r) => ({ userId: r.userId, splitMode: 'even', amount: r.amount, percentage: null }));
    } else if (mode === 'percentage') {
      splits = rows.map((r) => ({
        userId: r.userId,
        splitMode: 'percentage',
        percentage: r.percentage,
        amount: ((parseFloat(r.percentage) / 100) * total).toFixed(2),
      }));
    } else {
      splits = rows.map((r) => ({ userId: r.userId, splitMode: 'amount', amount: r.amount, percentage: null }));
    }

    onConfirm(splits);
  }

  const MODES: { value: SplitMode; label: string; description: string }[] = [
    { value: 'even', label: 'Even split', description: `${fmt(total / members.length)} each` },
    { value: 'percentage', label: 'By percentage', description: 'Assign % to each person' },
    { value: 'amount', label: 'By amount', description: 'Assign $ to each person' },
    { value: 'solo', label: 'Solo', description: 'One person pays in full' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">Set split</h2>
            <p className="text-sm text-gray-400 mt-0.5 truncate max-w-xs">{expenseTitle} · {fmt(total)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div className="p-5 space-y-5">
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

          {mode === 'solo' && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Who pays?</p>
              <div className="space-y-1">
                {members.map((m) => (
                  <label key={m.userId} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-800">
                    <input type="radio" name="solo-user" checked={soloUserId === m.userId} onChange={() => setSoloUserId(m.userId)} className="accent-indigo-500" />
                    <span className="text-white text-sm">{m.user.username}</span>
                    {soloUserId === m.userId && <span className="ml-auto text-sm text-white font-medium">{fmt(total)}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

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

          {mode === 'percentage' && (
            <div className="space-y-2">
              {rows.map((r) => {
                const amt = (parseFloat(r.percentage || '0') / 100) * total;
                return (
                  <div key={r.userId} className="flex items-center gap-3">
                    <span className="text-white text-sm w-24 truncate">{r.username}</span>
                    <div className="relative flex-1">
                      <input type="number" min={0} max={100} step={0.01} value={r.percentage}
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

          {mode === 'amount' && (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.userId} className="flex items-center gap-3">
                  <span className="text-white text-sm w-24 truncate">{r.username}</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <input type="number" min={0} step={0.01} value={r.amount}
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
            <button onClick={confirm} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2.5 rounded-lg transition-colors">
              Confirm split
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
