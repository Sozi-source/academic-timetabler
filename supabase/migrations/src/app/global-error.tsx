'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Fatal global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 font-sans text-gray-900 dark:text-gray-100">
        <div className="max-w-md w-full text-center space-y-6 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Application Error
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              A critical error occurred. Please reload the application to restore your session.
            </p>
          </div>

          <div>
            <button
              onClick={() => reset()}
              type="button"
              className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
