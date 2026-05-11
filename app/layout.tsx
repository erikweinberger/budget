import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { headers } from 'next/headers';
import Sidebar from '@/components/Sidebar';
import AuthInterceptor from '@/components/AuthInterceptor';
import { BoardProvider } from '@/lib/board-context';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'Budget',
  description: 'Personal budgeting app',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const username = headersList.get('x-username');

  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="h-full bg-gray-950 text-white">
        {username ? (
          <BoardProvider>
            <div className="flex h-full">
              <AuthInterceptor />
              <Sidebar username={username} />
              <main className="flex-1 overflow-auto">{children}</main>
            </div>
          </BoardProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
