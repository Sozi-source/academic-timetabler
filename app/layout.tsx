import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/toaster';
import { ScrollPreservation } from '@/components/ui/scroll-preservation';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Academic Planning System',
    template: '%s | Academic Planning System',
  },
  description: 'Academic planning, timetabling, student management and assessment.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        suppressHydrationWarning
        className="flex min-h-full flex-col"
      >
        {children}
        <ScrollPreservation />
        <Toaster />
      </body>
    </html>
  );
}