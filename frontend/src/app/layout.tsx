import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Bug Bounty Automation Platform',
  description: 'Automated reconnaissance and vulnerability scanning for bug bounty programs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-dark-950 text-slate-200 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

