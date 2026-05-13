'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useBoard } from '@/lib/board-context';

const NAV = [
  { href: '/', label: 'Summary', icon: '▦' },
  { href: '/expenses', label: 'Expenses', icon: '$' },
  { href: '/categories', label: 'Categories', icon: '⊞' },
];

export default function Sidebar({ username }: { username: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [creating, setCreating] = useState(false);
  const [boardError, setBoardError] = useState('');
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState<number | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [balance, setBalance] = useState<{ userId: number; username: string; net: number }[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const { boards, activeBoard, setActiveBoard, reload } = useBoard();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  async function createBoard() {
    if (!newBoardName.trim()) return;
    setCreating(true);
    setBoardError('');
    const r = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBoardName.trim() }),
    });
    if (r.ok) {
      await reload();
      setNewBoardName('');
      setShowNewBoard(false);
    } else {
      const d = await r.json().catch(() => ({}));
      setBoardError(d.error ?? `Error ${r.status}`);
    }
    setCreating(false);
  }

  useEffect(() => {
    if (!activeBoard) { setBalance([]); return; }
    fetch(`/api/boards/${activeBoard.id}/balance`)
      .then(r => r.ok ? r.json() : [])
      .then(setBalance);
  }, [activeBoard]);

  async function deleteBoard(boardId: number) {
    await fetch(`/api/boards/${boardId}`, { method: 'DELETE' });
    setConfirmDeleteBoard(null);
    if (activeBoard?.id === boardId) setActiveBoard(null);
    await reload();
  }

  async function addMember() {
    if (!newMemberUsername.trim() || !activeBoard) return;
    setAddingMember(true);
    setMemberError('');
    const r = await fetch(`/api/boards/${activeBoard.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newMemberUsername.trim() }),
    });
    if (r.ok) {
      await reload();
      setNewMemberUsername('');
      setShowAddMember(false);
    } else {
      const d = await r.json().catch(() => ({}));
      setMemberError(d.error ?? `Error ${r.status}`);
    }
    setAddingMember(false);
  }

  return (
    <aside
      className={`h-screen flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-200 flex-shrink-0 ${
        collapsed ? 'w-14' : 'w-52'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        {!collapsed && <span className="text-white font-bold text-lg tracking-tight">Budget</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-white p-1 rounded ml-auto"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Board selector */}
      {!collapsed && (
        <div className="px-3 py-2 border-b border-gray-800">
          <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Board</p>
          {boards.length === 0 ? (
            <p className="text-xs text-gray-600 italic">No boards yet</p>
          ) : (
            <div className="space-y-0.5">
              {boards.map((board) => (
                <div key={board.id}>
                  <div className="flex items-center group">
                    <button
                      onClick={() => setActiveBoard(board)}
                      className={`flex-1 text-left text-sm px-2 py-1.5 rounded-lg truncate transition-colors ${
                        activeBoard?.id === board.id
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                    >
                      {board.name}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteBoard(confirmDeleteBoard === board.id ? null : board.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs px-1 transition-all"
                      title="Delete board"
                    >
                      ✕
                    </button>
                  </div>
                  {confirmDeleteBoard === board.id && (
                    <div className="mx-1 mb-1 p-2 bg-gray-800 rounded-lg border border-red-900/50">
                      <p className="text-xs text-gray-300 mb-2">Delete &quot;{board.name}&quot;? All expenses will be removed.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => deleteBoard(board.id)}
                          className="flex-1 text-xs bg-red-700 hover:bg-red-600 text-white py-1 rounded transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteBoard(null)}
                          className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-white py-1 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showNewBoard ? (
            <div className="mt-2">
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={newBoardName}
                  onChange={(e) => { setNewBoardName(e.target.value); setBoardError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') createBoard(); if (e.key === 'Escape') { setShowNewBoard(false); setBoardError(''); } }}
                  placeholder="Board name"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={createBoard}
                  disabled={creating}
                  className="text-xs text-indigo-400 hover:text-indigo-300 px-1"
                >
                  {creating ? '...' : '✓'}
                </button>
              </div>
              {boardError && <p className="text-red-400 text-xs mt-1">{boardError}</p>}
            </div>
          ) : (
            <button
              onClick={() => setShowNewBoard(true)}
              className="mt-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              + New board
            </button>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Board members (when expanded) */}
      {!collapsed && activeBoard && (
        <div className="px-3 py-2 border-t border-gray-800">
          <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Members</p>
          <div className="space-y-1">
            {activeBoard.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-indigo-700 flex items-center justify-center text-xs text-white font-medium flex-shrink-0">
                  {m.user.username[0].toUpperCase()}
                </div>
                <span className="text-xs text-gray-400 truncate">{m.user.username}</span>
                {m.role === 'owner' && <span className="text-xs text-gray-600 ml-auto">owner</span>}
              </div>
            ))}
          </div>

          {showAddMember ? (
            <div className="mt-2">
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={newMemberUsername}
                  onChange={(e) => { setNewMemberUsername(e.target.value); setMemberError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') addMember(); if (e.key === 'Escape') { setShowAddMember(false); setMemberError(''); } }}
                  placeholder="Username"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={addMember}
                  disabled={addingMember}
                  className="text-xs text-indigo-400 hover:text-indigo-300 px-1"
                >
                  {addingMember ? '...' : '✓'}
                </button>
                <button
                  onClick={() => { setShowAddMember(false); setMemberError(''); }}
                  className="text-xs text-gray-500 hover:text-gray-300 px-1"
                >
                  ✕
                </button>
              </div>
              {memberError && <p className="text-red-400 text-xs mt-1">{memberError}</p>}
            </div>
          ) : (
            <button
              onClick={() => setShowAddMember(true)}
              className="mt-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              + Add member
            </button>
          )}
        </div>
      )}

      {/* Balance summary */}
      {!collapsed && balance.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-800">
          <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Balance</p>
          <div className="space-y-1">
            {balance.map((entry) => (
              <div key={entry.userId} className="flex items-center justify-between">
                <span className="text-xs text-gray-400 truncate">{entry.net > 0 ? `${entry.username} owes you` : `You owe ${entry.username}`}</span>
                <span className={`text-xs font-semibold ml-2 ${entry.net > 0 ? 'text-green-400' : 'text-amber-400'}`}>
                  {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Math.abs(entry.net))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-gray-800">
        {!collapsed && (
          <p className="text-xs text-gray-500 mb-2 px-1 truncate">{username}</p>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title={collapsed ? 'Sign out' : undefined}
        >
          <span className="text-base w-5 text-center flex-shrink-0">↩</span>
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </aside>
  );
}
