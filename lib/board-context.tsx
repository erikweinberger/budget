'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface BoardMember {
  id: number;
  userId: number;
  role: string;
  user: { id: number; username: string };
}

export interface Board {
  id: number;
  name: string;
  createdByUserId: number;
  members: BoardMember[];
}

interface BoardContextValue {
  boards: Board[];
  activeBoard: Board | null;
  setActiveBoard: (board: Board) => void;
  reload: () => void;
  loading: boolean;
}

const BoardContext = createContext<BoardContextValue>({
  boards: [],
  activeBoard: null,
  setActiveBoard: () => {},
  reload: () => {},
  loading: true,
});

export function BoardProvider({ children }: { children: ReactNode }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoard, setActiveBoardState] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch('/api/boards');
    if (!r.ok) return;
    const data: Board[] = await r.json();
    setBoards(data);
    setActiveBoardState((prev) => {
      if (prev) return data.find((b) => b.id === prev.id) ?? data[0] ?? null;
      return data[0] ?? null;
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <BoardContext.Provider value={{ boards, activeBoard, setActiveBoard: setActiveBoardState, reload: load, loading }}>
      {children}
    </BoardContext.Provider>
  );
}

export function useBoard() {
  return useContext(BoardContext);
}
