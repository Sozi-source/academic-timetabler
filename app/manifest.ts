import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/staff',
    name: 'Imperial College Trainer Portal',
    short_name: 'Trainer Portal',
    description: 'Teaching schedules, attendance, units, assessments, and documents.',
    start_url: '/staff',
    scope: '/staff',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f7faf9',
    theme_color: '#075b52',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'My timetable',
        short_name: 'Timetable',
        url: '/staff/timetable',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Attendance register',
        short_name: 'Attendance',
        url: '/staff/attendance',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
