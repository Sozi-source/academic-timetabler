'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpenCheck,
  Building2,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Stethoscope,
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
      icon: Stethoscope,
      hubHref: '/operations/daily-reports',
      statNumber: snapshot?.attendance?.completed ?? 0,
      statLabel: 'Logged Sessions',
      statusPill: snapshot?.attendance?.open > 0 ? `${snapshot.attendance.open} Open` : 'Compliant',
      statusPillType: snapshot?.attendance?.open > 0 ? 'warning' : 'success',
      featuredLinks: [
        { label: 'Trainer Daily Reports (Live Log)', href: '/operations/daily-reports' },
        { label: 'Class Attendance Registry', href: '/attendance' },
        { label: 'Operations Action Centre', href: '/operations/action-center' },
      ],
    },
    {
      id: 'timetabling',
      title: 'Timetabling & Schedules',
      category: 'Academic Planning',
      icon: CalendarRange,
      hubHref: '/timetable/readiness',
      statNumber: snapshot?.timetable?.activeAllocations ?? 0,
      statLabel: 'Teaching Allocations',
      statusPill: 'Published',
      statusPillType: 'success',
      featuredLinks: [
        { label: 'Timetable Readiness Check', href: '/timetable/readiness' },
        { label: 'Automated Timetable Generator', href: '/timetable/generator' },
        { label: 'Teaching Allocations & Workloads', href: '/timetable/teaching-allocations' },
      ],
    },
    {
      id: 'curriculum',
      title: 'Curriculum & Documents',
      category: 'Quality Assurance',
      icon: BookOpenCheck,
      hubHref: '/teaching-documents/curriculum',
      statNumber: '14 Wks',
      statLabel: 'Syllabus Framework',
      statusPill: 'TVET Standard',
      statusPillType: 'gold',
      featuredLinks: [
        { label: 'Curriculum Content (14 Weeks)', href: '/teaching-documents/curriculum' },
        { label: 'Trainer Document Review & Approval', href: '/teaching-documents/review' },
        { label: 'Syllabus Word (.docx) Importer', href: '/teaching-documents/curriculum/editor' },
      ],
    },
    {
      id: 'assessment',
      title: 'Assessment & Marks Workflow',
      category: 'Grading & QA',
      icon: ClipboardList,
      hubHref: '/assessment',
      statNumber: `${snapshot?.assessment?.finalised ?? 0} / ${snapshot?.assessment?.total ?? 3}`,
      statLabel: 'Finalised Markbooks',
      statusPill: `${snapshot?.assessment?.published ?? 0} Published`,
      statusPillType: 'gold',
      featuredLinks: [
        { label: 'Assessment Control Centre', href: '/assessment' },
        { label: 'Unit Markbooks & Grading', href: '/assessment/assessments' },
        { label: 'CAT & Exam Performance Reports', href: '/assessment/reports' },
      ],
    },
    {
      id: 'students',
      title: 'Student Lifecycle & Registry',
      category: 'Enrollment & PINs',
      icon: GraduationCap,
      hubHref: '/students/registry',
      statNumber: `${snapshot?.students?.registered ?? 24} / ${snapshot?.students?.eligible ?? 185}`,
      statLabel: 'Registered Students',
      statusPill: `${snapshot?.students?.portalActive ?? 185} Active PINs`,
      statusPillType: 'success',
      featuredLinks: [
        { label: 'Student Admissions Registry', href: '/students/registry' },
        { label: 'Portal Access & PIN Issuance', href: '/students/access' },
        { label: 'Student Status & Progression', href: '/students/progression' },
      ],
    },
    {
      id: 'setup',
      title: 'Master Data & System Setup',
      category: 'Configuration',
      icon: Building2,
      hubHref: '/timetable/imports',
      statNumber: 'Active',
      statLabel: 'Master Data Setup',
      statusPill: 'Ready',
      statusPillType: 'success',
      featuredLinks: [
        { label: 'Bulk Excel Master Data Imports', href: '/timetable/imports' },
        { label: 'Academic Years & Terms', href: '/timetable/academic-periods' },
        { label: 'Trainers & Availability Setup', href: '/timetable/trainers' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hub Gateways Grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {hubs.map((hub) => {
          const Icon = hub.icon;

          return (
            <div
              key={hub.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#cbd6d4] bg-white p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2f706b] hover:shadow-[0_8px_30px_rgb(47,112,107,0.06)]"
            >
              {/* Brand Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#f5c400] transition-colors duration-200 group-hover:bg-[#2f706b]" />

              <div className="pt-1.5">
                {/* 1. Header Row: Category Badge & Status Pill */}
                <div className="flex items-center justify-between gap-2 border-b border-[#e9eeed] pb-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#718096]">
                    {hub.category}
                  </span>

                  {hub.statusPillType === 'gold' ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-[#d4aa00] bg-[#fff9dc] px-2 py-0.5 text-[10px] font-bold text-[#3f3500]">
                      <span className="size-1 rounded-full bg-[#f5c400]" />
                      {hub.statusPill}
                    </span>
                  ) : hub.statusPillType === 'warning' ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      <span className="size-1 rounded-full bg-amber-500" />
                      {hub.statusPill}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                      <span className="size-1 rounded-full bg-emerald-600" />
                      {hub.statusPill}
                    </span>
                  )}
                </div>

                {/* 2. Interactive Title Row */}
                <Link
                  href={hub.hubHref}
                  className="mt-3.5 flex items-center justify-between gap-3 text-[#1f2937] hover:text-[#2f706b] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f2f1] text-[#2f706b]">
                      <Icon className="size-4.5" aria-hidden="true" />
                    </div>
                    <h2 className="text-sm font-bold tracking-tight">
                      {hub.title}
                    </h2>
                  </div>
                  <ArrowUpRight className="size-4 text-[#94a3b8] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#2f706b]" />
                </Link>

                {/* 3. Clean Inline Metric Summary */}
                <div className="mt-3 flex items-center justify-between border-b border-[#e9eeed] pb-3 text-xs">
                  <span className="text-[#718096] text-[11px]">{hub.statLabel}</span>
                  <span className="font-bold text-[#103c39]">{hub.statNumber}</span>
                </div>

                {/* 4. Streamlined Actions Menu */}
                <div className="mt-3 space-y-1">
                  {hub.featuredLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs text-[#52606d] transition hover:bg-[#e8f2f1]/60 hover:text-[#103c39]"
                    >
                      <span className="truncate font-medium">{link.label}</span>
                      <ChevronRight className="size-3 text-[#94a3b8] opacity-0 transition duration-150 group-hover:opacity-100" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
