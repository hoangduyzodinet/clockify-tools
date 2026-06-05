import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clockify Tools',
  description: 'Generate Clockify time entries from GitHub commits.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-lg font-semibold text-slate-950">
                Clockify Tools
              </Link>
              <div className="flex items-center gap-4 text-sm font-medium">
                <Link href="/" className="text-slate-600 hover:text-slate-950">
                  Generate
                </Link>
                <Link href="/settings" className="text-slate-600 hover:text-slate-950">
                  Settings
                </Link>
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
