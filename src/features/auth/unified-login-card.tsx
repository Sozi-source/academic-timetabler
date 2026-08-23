'use client';

import { useState } from 'react';
import {
  CalendarDays,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { LoginForm } from './login-form';
import { StudentLoginForm } from '@/features/student-portal/student-login-form';

interface UnifiedLoginCardProps {
  defaultRole?: 'staff' | 'student';
  nextPath?: string;
}

export function UnifiedLoginCard({
  defaultRole = 'staff',
  nextPath,
}: UnifiedLoginCardProps) {
  const [role, setRole] = useState<'staff' | 'student'>(defaultRole);

  return (
    <section
      className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-white shadow-xl"
      aria-labelledby="login-title"
    >
      {/* Top Brand Banner */}
      <div className="flex h-[4.75rem] items-center gap-3 border-b border-primary/20 bg-institutional-yellow px-6">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary-deeper text-white shadow-sm ring-1 ring-black/10">
          <CalendarDays className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold tracking-tight text-primary-deeper">
            Academic Planning System
          </p>
          <p className="text-[11px] font-medium text-primary-deep/80">
            Imperial College of Medical & Health Sciences
          </p>
        </div>
      </div>

      <div className="p-6">
        {/* Role Selector Tabs */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-surface-subtle p-1 border border-border">
          <button
            type="button"
            onClick={() => setRole('staff')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition ${
              role === 'staff'
                ? 'bg-white text-primary shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <UserRound className="size-3.5" aria-hidden="true" />
            <span>Staff & Trainers</span>
          </button>

          <button
            type="button"
            onClick={() => setRole('student')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition ${
              role === 'student'
                ? 'bg-white text-primary shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <GraduationCap className="size-3.5" aria-hidden="true" />
            <span>Students</span>
          </button>
        </div>

        {/* Dynamic Portal Header */}
        <div className="mb-5">
          <h1 id="login-title" className="text-xl font-bold tracking-tight text-text-primary">
            {role === 'staff' ? 'Staff & Trainer Sign In' : 'Student Portal Access'}
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            {role === 'staff'
              ? 'Sign in with your institutional email to access dashboards & daily reports.'
              : 'Enter your admission number and department-issued PIN.'}
          </p>
        </div>

        {/* Selected Form Component */}
        {role === 'staff' ? (
          <LoginForm nextPath={nextPath} />
        ) : (
          <div className="space-y-4">
            <StudentLoginForm />
          </div>
        )}
      </div>
    </section>
  );
}
