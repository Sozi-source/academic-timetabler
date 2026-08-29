'use client';

import { BookOpenCheck, CalendarCheck2, CalendarDays, ClipboardCheck, FileText, GraduationCap, LayoutDashboard, LogOut, Menu, UserRound, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { studentPortalLogout } from '@/features/student-portal/actions';
import type { StudentPortalIdentity } from '@/features/student-portal/types';
import { cn } from '@/lib/utils/cn';

interface NavigationItem { label: string; href: string; icon: LucideIcon }
const navigation: readonly NavigationItem[] = [
  { label: 'Dashboard', href: '/student', icon: LayoutDashboard }, { label: 'My Units', href: '/student/units', icon: BookOpenCheck },
  { label: 'Timetable', href: '/student/timetable', icon: CalendarDays }, { label: 'Registration', href: '/student/unit-registration', icon: ClipboardCheck },
  { label: 'Results', href: '/student/results', icon: GraduationCap }, { label: 'Attendance', href: '/student/attendance', icon: CalendarCheck2 },
  { label: 'Documents', href: '/student/documents', icon: FileText }, { label: 'Profile', href: '/student/profile', icon: UserRound },
];
const bottomNavigation = [navigation[0], navigation[2], navigation[4]];
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');

export function StudentPortalShell({ student, children }: { student: StudentPortalIdentity; children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const studentInitials = initials(student.fullName) || 'ST';
  const isActive = (href: string) => pathname === href || (href !== '/student' && pathname.startsWith(`${href}/`));

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0b4f4a] text-white">
      <div className="flex h-[4.5rem] items-center gap-3 border-b border-white/10 px-5">
        <span className="flex size-[2.375rem] shrink-0 items-center justify-center rounded-[0.625rem] bg-[#ffd400] text-[#0b4f4a] shadow-lg shadow-black/15"><GraduationCap className="size-5" /></span>
        <div className="min-w-0"><p className="truncate text-[0.95rem] font-semibold tracking-tight">Imperial College</p><p className="mt-0.5 text-[0.625rem] font-medium text-white/70">Academic Portal</p></div>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-white/55">Academics</p>
        <div className="space-y-1">{navigation.map((item) => { const active = isActive(item.href); const Icon = item.icon; return (
          <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={cn('relative flex min-h-11 items-center gap-3 rounded-lg border-l-[3px] px-3 text-sm font-medium transition-all duration-200 active:scale-[.98]', active ? 'border-l-[#ffd400] bg-white/13 text-white' : 'border-l-transparent text-white/80 hover:bg-white/8 hover:text-white')}>
            <span className="flex size-8 items-center justify-center rounded-lg text-white/80"><Icon className="size-[1.05rem]" /></span><span>{item.label}</span>
          </Link>
        ); })}</div>
      </nav>
      <div className="border-t border-white/10 p-3"><div className="flex items-center gap-3 rounded-2xl bg-white/7 p-3 ring-1 ring-white/8">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fff8cc] text-xs font-bold text-[#0b4f4a]">{studentInitials}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{student.fullName}</p><p className="mt-0.5 truncate text-[0.625rem] text-white/55">{student.admissionNumber}</p></div>
        <form action={studentPortalLogout}><button type="submit" aria-label="Sign out" className="flex size-9 items-center justify-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-white"><LogOut className="size-4" /></button></form>
      </div></div>
    </div>
  );

  return <div className="academic-portal min-h-screen bg-background">
    <div className="fixed inset-x-0 top-0 z-[60] h-1 bg-[#ffd400]" />
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[14.75rem] shadow-xl lg:block">{sidebar}</aside>
    <div className={cn('fixed inset-0 z-50 lg:hidden transition-[visibility] duration-300', mobileOpen ? 'visible' : 'invisible delay-300')} aria-hidden={!mobileOpen}>
      <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className={cn('absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-300', mobileOpen ? 'opacity-100' : 'opacity-0')} />
      <div className={cn('relative h-full w-[19rem] max-w-[86vw] shadow-2xl transition-transform duration-300 ease-out', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>{sidebar}<button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-xl bg-white/10 text-white transition active:scale-95"><X className="size-5" /></button></div>
    </div>
    <div className="min-w-0 lg:pl-[14.75rem]">
      <header className="sticky top-0 z-30 flex h-[4.625rem] items-center justify-between border-b border-border bg-surface/95 px-4 shadow-sm backdrop-blur-xl sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="flex size-[2.625rem] shrink-0 items-center justify-center rounded-[0.625rem] border border-border bg-surface text-primary-deep shadow-sm transition active:scale-95 lg:hidden"><Menu className="size-5" /></button><div className="min-w-0"><p className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-text-muted">Student workspace</p><p className="truncate text-sm font-semibold text-text-primary">{student.fullName}</p></div></div>
        <span className="flex size-9 items-center justify-center rounded-full bg-[#fff8cc] text-xs font-bold text-[#0b4f4a] ring-2 ring-white">{studentInitials}</span>
      </header>
      <main className="portal-page-content mx-auto w-full max-w-7xl px-3.5 py-[1.125rem] pb-24 sm:px-6 sm:py-7 lg:px-[1.625rem] lg:pb-8">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(11,79,74,.08)] backdrop-blur-xl lg:hidden"><div className="mx-auto grid h-16 max-w-xl grid-cols-4">
        {bottomNavigation.map((item) => { const active = isActive(item.href); const Icon = item.icon; return <Link key={item.href} href={item.href} className={cn('relative flex flex-col items-center justify-center gap-1 text-[0.625rem] font-semibold transition active:scale-95', active ? 'text-primary' : 'text-text-muted')}>{active ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#ffd400]" /> : null}<Icon className={cn('size-[1.125rem]', active && 'stroke-[2.5]')} /><span className="max-w-[4.5rem] truncate">{item.label}</span></Link>; })}
        <button type="button" onClick={() => setMobileOpen(true)} className="flex flex-col items-center justify-center gap-1 text-[0.625rem] font-semibold text-text-muted transition active:scale-95" aria-label="Open more navigation"><Menu className="size-[1.125rem]" /><span>More</span></button>
      </div></nav>
    </div>
  </div>;
}
