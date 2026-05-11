'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <p className="text-4xl mb-4">⚠️</p>
      <p className="text-xl font-bold text-white mb-2">Something went wrong</p>
      <p className="text-gray-400 text-sm mb-6 max-w-sm">{error.message || 'An unexpected error occurred.'}</p>
      <button
        onClick={reset}
        className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
