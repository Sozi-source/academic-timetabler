import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  FileChartColumn,
  FileSpreadsheet,
  ListChecks,
  PencilRuler,
  Presentation,
  School,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';

export const metadata: Metadata = {
  title: 'Academic Planning & Timetabling | Academic Planning System',
  description: 'Manage scheduling readiness, timetable editor, publications, and master data setup.',
};

export default async function TimetableHubPage() {
  await requireHodAccess();

  const schedulingSteps = [
    {
      title: 'Check Readiness',
      description: 'Offerings, allocations & room limits.',
      href: '/timetable/readiness',
      icon: ClipboardCheck,
      badge: 'Step 1',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      title: 'Review & Edit',
      description: 'Clash-detected schedule editor.',
      href: '/timetable/editor',
      icon: PencilRuler,
      badge: 'Step 2',
      color: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      title: 'Published Timetables',
      description: 'Active snapshots on portals.',
      href: '/timetable/published',
      icon: FileChartColumn,
      badge: 'Step 3',
      color: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    {
      title: 'Timetable Reports',
      description: 'PDF & Word export center.',
      href: '/timetable/reports',
      icon: ListChecks,
      badge: 'Export',
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    },
  ];

  const masterSetupItems = [
    {
      label: 'Academic Periods',
      description: 'Term & semester dates',
      href: '/timetable/academic-periods',
      icon: CalendarRange,
    },
    {
      label: 'Programmes & Cohorts',
      description: 'Class groups & curriculum',
      href: '/timetable/cohorts',
      icon: School,
    },
    {
      label: 'Unit Offerings',
      description: 'Active term offerings',
      href: '/timetable/unit-offerings',
      icon: BookOpen,
    },
    {
      label: 'Trainers & Staff',
      description: 'Staff directory & loads',
      href: '/timetable/trainers',
      icon: UserRound,
    },
    {
      label: 'Teaching Allocations',
      description: 'Trainer assignments',
      href: '/timetable/teaching-allocations',
      icon: Presentation,
    },
    {
      label: 'Lecture Rooms',
      description: 'Venues & capacity',
      href: '/timetable/rooms',
      icon: Building2,
    },
    {
      label: 'Scheduling Constraints',
      description: 'Rules & forbidden slots',
      href: '/timetable/constraints',
      icon: SlidersHorizontal,
    },
    {
      label: 'Excel Master Imports',
      description: 'Bulk data upload',
      href: '/timetable/imports',
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="max-w-[var(--content-max-width)] mx-auto space-y-6">
      <PageHeader
        eyebrow="Academic Operations"
        title="Academic Planning & Timetabling"
        description="Schedule generation, live editing, and master institutional setup."
        icon={CalendarDays}
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      {/* 1. Core Scheduling Workflow */}
      <section aria-labelledby="scheduling-workflow-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="scheduling-workflow-heading" className="text-sm font-bold uppercase tracking-wider text-gray-700">
            Timetable Engine & Workflow
          </h2>
          <span className="text-xs text-gray-500 font-medium">Core Scheduling Lifecycle</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {schedulingSteps.map((step) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.title}
                href={step.href}
                className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-[#033B36]/30 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`flex size-10 items-center justify-center rounded-xl border ${step.color} shadow-2xs`}>
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                      {step.badge}
                    </span>
                  </div>

                  <h3 className="mt-4 text-sm font-bold text-gray-900 group-hover:text-[#033B36] transition-colors">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-[#033B36]">
                  <span>Open workspace</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 2. Master Data Setup */}
      <section aria-labelledby="master-setup-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="master-setup-heading" className="text-sm font-bold uppercase tracking-wider text-gray-700">
            Master Setup & Structure
          </h2>
          <span className="text-xs text-gray-500 font-medium">Institutional Configuration</span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {masterSetupItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-start gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition-all hover:border-gray-300 hover:bg-gray-50/70"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700 group-hover:bg-[#033B36] group-hover:text-white transition-colors">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 group-hover:text-[#033B36] transition-colors">
                    {item.label}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500">
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
