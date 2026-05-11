'use client';

import { useEffect, useState } from 'react';

interface Keyword { id: number; keyword: string; }
interface Category {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
  keywords: Keyword[];
}

export default function CategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6B7280');
  const [kwInputs, setKwInputs] = useState<Record<number, string>>({});

  function dedup(list: Category[]): Category[] {
    const seen = new Map<string, Category>();
    for (const c of [...list].sort((a, b) => a.id - b.id)) {
      if (!seen.has(c.name)) seen.set(c.name, c);
    }
    return Array.from(seen.values());
  }

  async function load() {
    const r = await fetch('/api/categories');
    setCats(dedup(await r.json()));
  }

  useEffect(() => { load(); }, []);

  async function addCategory() {
    if (!newName.trim()) return;
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    setNewName('');
    load();
  }

  async function deleteCategory(id: number) {
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    load();
  }

  async function addKeyword(catId: number) {
    const kw = kwInputs[catId]?.trim();
    if (!kw) return;
    await fetch(`/api/categories/${catId}/keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: kw }),
    });
    setKwInputs((p) => ({ ...p, [catId]: '' }));
    load();
  }

  async function deleteKeyword(catId: number, kwId: number) {
    await fetch(`/api/categories/${catId}/keywords/${kwId}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-6">Categories</h1>

      {/* Add category */}
      <div className="flex gap-3 mb-8">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          placeholder="New category name"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="w-10 h-9 rounded cursor-pointer bg-transparent border-0"
          title="Pick color"
        />
        <button
          onClick={addCategory}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          + Add
        </button>
      </div>

      {/* Category list */}
      <div className="space-y-4">
        {cats.map((cat) => (
          <div key={cat.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: cat.color }} />
                <span className="font-medium text-white">{cat.name}</span>
                {cat.isDefault && (
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">default</span>
                )}
              </div>
              {!cat.isDefault && (
                <button
                  onClick={() => deleteCategory(cat.id)}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>

            {/* Keywords */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {cat.keywords.map((kw) => (
                <span
                  key={kw.id}
                  className="flex items-center gap-1 bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded"
                >
                  {kw.keyword}
                  <button
                    onClick={() => deleteKeyword(cat.id, kw.id)}
                    className="text-gray-500 hover:text-red-400 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={kwInputs[cat.id] ?? ''}
                onChange={(e) => setKwInputs((p) => ({ ...p, [cat.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addKeyword(cat.id)}
                placeholder="Add keyword..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={() => addKeyword(cat.id)}
                className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1.5"
              >
                + Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
