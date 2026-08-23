'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layers,
  ListChecks,
  PencilRuler,
  Presentation,
  School,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  UserRound,
  UsersRound,
} from 'lucide-react';

interface DashboardViewProps {
  departmentName: string;
  activePeriodName: string | null;
  snapshot: any;
}

export function DashboardView({
  departmentName,
  activePeriodName,
  snapshot,
}: DashboardViewProps) {
  const hubs = [
    {
      id: 'attendance',
      title: 'Attendance & Daily Reports',
      category: 'Daily Operations',
      description: 'Trainer daily teaching logs, student absentees and live session compliance.',
      icon: Stethoscope,
      hubHref: '/operations/daily-reports',
      buttonLabel: 'Open Daily Reports Hub',
      statNumber: snapshot?.attendance?.completed ?? 0,
      statLabel: 'Logged Sessions',
      statusPill: snapshot?.attendance?.open > 0 ? `${snapshot.attendance.open} Open Today` : 'Compliant Today',
      statusPillType: snapshot?.attendance?.open > 0 ? 'warning' : 'success',
      featuredLinks: [
        { label: 'Trainer Daily Reports (Live Log)', href: '/operations/daily-reports', badge: 'Daily' },
        { label: 'Class Attendance Registry', href: '/attendance' },
        { label: 'Operations Action Centre', href: '/operations/action-center' },
      ],
    },
    {
      id: 'timetabling',
      title: 'Timetabling & Schedules',
      category: 'Academic Planning',
      description: 'Automated timetable generation, conflict resolution and published schedules.',
      icon: CalendarRange,
      hubHref: '/timetable/readiness',
      buttonLabel: 'Open Timetable Hub',
      statNumber: snapshot?.timetable?.activeAllocations ?? 0,
      statLabel: 'Teaching Allocations',
      statusPill: 'Published Version Active',
      statusPillType: 'success',
      featuredLinks: [
        { label: '1. Timetable Readiness Check', href: '/timetable/readiness', badge: 'Step 1' },
        { label: '2. Automated Timetable Generator', href: '/timetable/generator', badge: 'Auto' },
        { label: 'Teaching Allocations & Workloads', href: '/timetable/teaching-allocations' },
      ],
    },
    {
      id: 'curriculum',
      title: 'Curriculum & Teaching Documents',
      category: 'Quality Assurance',
      description: 'Standardised 14-week Course Outlines, Schemes of Work and syllabus approvals.',
      icon: BookOpenCheck,
      hubHref: '/teaching-documents/curriculum',
      buttonLabel: 'Open Curriculum Hub',
      statNumber: '14 Wks',
      statLabel: 'Standardised Framework',
      statusPill: 'TVET Standardised',
      statusPillType: 'gold',
      featuredLinks: [
        { label: 'Curriculum Content (14 Weeks)', href: '/teaching-documents/curriculum', badge: '14 Weeks' },
        { label: 'Trainer Document Review & Approval', href: '/teaching-documents/review' },
        { label: 'Syllabus Word (.docx) Importer', href: '/teaching-documents/curriculum/editor' },
      ],
    },
    {
      id: 'assessment',
      title: 'Assessment & Marks Workflow',
      category: 'Grading & QA',
      description: 'Online markbooks, CAT & Exam grade entries, and performance reports.',
      icon: ClipboardList,
      hubHref: '/assessment',
      buttonLabel: 'Open Assessment Hub',
      statNumber: `${snapshot?.assessment?.finalised ?? 0} / ${snapshot?.assessment?.total ?? 3}`,
      statLabel: 'Finalised Markbooks',
      statusPill: `${snapshot?.assessment?.published ?? 0} Results Published`,
      statusPillType: 'gold',
      featuredLinks: [
        { label: 'Assessment Control Centre', href: '/assessment', badge: 'Overview' },
        { label: 'Unit Markbooks & Grading', href: '/assessment/assessments' },
        { label: 'CAT & Exam Performance Reports', href: '/assessment/reports' },
      ],
    },
    {
      id: 'students',
      title: 'Student Lifecycle & Registry',
      category: 'Enrollment & PINs',
      description: 'Student admission registry, cohort progression and student portal PIN access.',
      icon: GraduationCap,
      hubHref: '/students/registry',
      buttonLabel: 'Open Student Hub',
      statNumber: `${snapshot?.students?.registered ?? 24} / ${snapshot?.students?.eligible ?? 185}`,
      statLabel: 'Registered Students',
      statusPill: `${snapshot?.students?.portalActive ?? 185} PINs Active`,
      statusPillType: 'success',
      featuredLinks: [
        { label: 'Student Admissions Registry', href: '/students/registry' },
        { label: 'Portal Access & PIN Issuance', href: '/students/access', badge: 'Security' },
        { label: 'Student Status & Progression', href: '/students/progression' },
      ],
    },
    {
      id: 'setup',
      title: 'Master Data & System Setup',
      category: 'Configuration',
      description: 'Bulk Excel imports, academic periods, programmes, units, rooms and trainers.',
      icon: Building2,
      hubHref: '/timetable/imports',
      buttonLabel: 'Open Setup Hub',
      statNumber: '100%',
      statLabel: 'Master Data Setup',
      statusPill: 'Ready for Operations',
      statusPillType: 'success',
      featuredLinks: [
        { label: 'Bulk Excel Master Data Imports', href: '/timetable/imports', badge: 'Excel' },
        { label: 'Academic Years & Terms', href: '/timetable/academic-periods' },
        { label: 'Trainers & Availability Setup', href: '/timetable/trainers' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Hub Gateways Grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {hubs.map((hub) => {
          const Icon = hub.icon;

          return (
            <div
              key={hub.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#cbd6d4] bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2f706b] hover:shadow-md"
            >
              {/* Subtle top accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#2f706b] via-[#f5c400] to-[#2f706b] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

              <div>
                {/* Header Row: Category Badge & Status Pill */}
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#e8f2f1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#184f4b]">
                    {hub.category}
                  </span>

                  {hub.statusPillType === 'gold' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#d4aa00] bg-[#fff9dc] px-2.5 py-0.5 text-[10px] font-bold text-[#3f3500]">
                      <span className="size-1.5 rounded-full bg-[#f5c400]" />
                      {hub.statusPill}
                    </span>
                  ) : hub.statusPillType === 'warning' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      {hub.statusPill}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900">
                      <span className="size-1.5 rounded-full bg-emerald-600" />
                      {hub.statusPill}
                    </span>
                  )}
                </div>

                {/* Hub Title & Icon */}
                <div className="mt-4 flex items-start gap-3.5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#103c39] to-[#2f706b] text-[#f5c400] shadow-sm">
                    <Icon className="size-5.5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#1f2937] transition group-hover:text-[#184f4b]">
                      {hub.title}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-[#52606d] line-clamp-2">
                      {hub.description}
                    </p>
                  </div>
                </div>

                {/* Live Metric Highlight Strip */}
                <div className="mt-4 rounded-xl border border-[#dfe6e5] bg-[#f8faf9] px-3.5 py-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-medium text-[#718096]">
                      {hub.statLabel}
                    </span>
                    <span className="text-sm font-bold text-[#103c39]">
                      {hub.statNumber}
                    </span>
                  </div>
                </div>

                {/* Quick Access Links */}
                <div className="mt-3.5 space-y-1">
                  {hub.featuredLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#52606d] transition hover:bg-[#e8f2f1] hover:text-[#103c39]"
                    >
                      <span className="truncate">{link.label}</span>
                      {link.badge ? (
                        <span className="rounded bg-[#dfe6e5] px-1.5 py-0.5 text-[9px] font-semibold text-[#184f4b]">
                          {link.badge}
                        </span>
                      ) : (
                        <ChevronRight className="size-3 text-[#94a3b8] opacity-0 transition group-hover:opacity-100" />
                      )}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Primary Action Button */}
              <div className="mt-5 border-t border-[#dfe6e5] pt-3.5">
                <Link
                  href={hub.hubHref}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2f706b] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition duration-150 hover:bg-[#184f4b] hover:shadow-sm"
                >
                  <span>{hub.buttonLabel}</span>
                  <ArrowRight className="size-3.5 text-[#f5c400] transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
