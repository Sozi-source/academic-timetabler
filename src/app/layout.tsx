import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'HND Timetabler',
    template: '%s | HND Timetabler',
  },
  description: 'Simple departmental timetable creation and management.',
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
        <Toaster />
      </body>
    </html>
  );
}