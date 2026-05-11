import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <p className="text-5xl font-bold text-gray-700 mb-4">404</p>
      <p className="text-xl font-bold text-white mb-2">Page not found</p>
      <p className="text-gray-400 text-sm mb-6">This page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
      >
        Go home
      </Link>
    </div>
  );
}
