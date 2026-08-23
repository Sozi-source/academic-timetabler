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
      className="relative z-10 w-full max-w-[390px] overflow-hidden rounded-2xl border border-border bg-white shadow-lg"
      aria-labelledby="login-title"
    >
      {/* Top Brand Banner */}
      <div className="flex h-14 items-center gap-3 border-b border-primary/20 bg-institutional-yellow px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary-deeper text-white shadow-2xs">
          <CalendarDays className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold tracking-tight text-primary-deeper">
            Academic Planning System
          </p>
          <p className="truncate text-[10px] font-medium text-primary-deep/80">
            Imperial College of Medical & Health Sciences
          </p>
        </div>
      </div>

      <div className="p-5">
        {/* Role Selector Tabs */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-subtle p-1 border border-border">
          <button
            type="button"
            onClick={() => setRole('staff')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
              role === 'staff'
                ? 'bg-white text-primary shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <UserRound className="size-3.5" aria-hidden="true" />
            <span>Staff</span>
          </button>

          <button
            type="button"
            onClick={() => setRole('student')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
              role === 'student'
                ? 'bg-white text-primary shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <GraduationCap className="size-3.5" aria-hidden="true" />
            <span>Students</span>
          </button>
        </div>

        {/* Form Title */}
        <h1 id="login-title" className="mb-3 text-sm font-bold text-text-primary">
          {role === 'staff' ? 'Staff Sign In' : 'Student Portal Sign In'}
        </h1>

        {/* Selected Form Component */}
        {role === 'staff' ? (
          <LoginForm nextPath={nextPath} />
        ) : (
          <StudentLoginForm />
        )}
      </div>
    </section>
  );
}
