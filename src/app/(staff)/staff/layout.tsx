import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration';
import {
  StaffShell,
} from '@/components/staff/staff-shell';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';

export const metadata: Metadata = {
  title: 'Trainer Portal',
  description: 'Imperial College staff teaching workspace.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/favicon.ico', sizes: 'any' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      {
        url: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'Trainer Portal',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#075b52',
};

export default async function StaffLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const profile =
    await requireTrainerAccess();

  return (
    <>
      <ServiceWorkerRegistration />
      <StaffShell
        profile={
          profile
        }
      >
        {
          children
        }
      </StaffShell>
    </>
  );
}
