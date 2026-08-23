import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  ListChecks,
  PencilRuler,
  Presentation,
  School,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getOperationsSnapshot } from '@/features/operations/queries';

function formatPeriodDisplay(name: string | null | undefined): string {
  if (!name) return 'Not Set';
  return name
    .replace(/September/gi, 'Sep')
    .replace(/December/gi, 'Dec')
    .replace(/January/gi, 'Jan')
    .replace(/February/gi, 'Feb')
    .replace(/March/gi, 'Mar')
    .replace(/April/gi, 'Apr')
    .replace(/August/gi, 'Aug')
    .replace(/October/gi, 'Oct')
    .replace(/November/gi, 'Nov')
    .replace(/[-–—]+/g, ' – ');
}

export default async function DashboardPage() {
  const profile = await requireHodAccess();
  const snapshot = await getOperationsSnapshot().catch(() => null);

  const sections = [
    {
      title: 'Academic Planning & Timetabling',
      description: 'Generate, edit, publish, and manage teaching schedules & allocations.',
      icon: CalendarRange,
      color: 'bg-primary/10 text-primary border-primary/20',
      links: [
        { label: '1. Check Readiness', href: '/timetable/readiness', icon: ClipboardCheck },
        { label: '2. Timetable Generator', href: '/timetable/generator', icon: Sparkles, badge: 'Automated' },
        { label: '3. Timetable Editor', href: '/timetable/editor', icon: PencilRuler },
        { label: '4. Published Schedules', href: '/timetable/published', icon: CalendarDays },
        { label: 'Teaching Allocations', href: '/timetable/teaching-allocations', icon: Presentation },
        { label: 'Timetable Reports', href: '/timetable/reports', icon: ListChecks },
      ],
    },
    {
      title: 'Student Registry & Onboarding',
      description: 'Manage student records, cohort progression, registrations & PIN access.',
      icon: GraduationCap,
      color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      links: [
        { label: 'Student Registry', href: '/students/registry', icon: UserRound },
        { label: 'Unit Registration', href: '/students/unit-registration', icon: BookOpen },
        { label: 'Portal Access & PINs', href: '/students/access', icon: ShieldCheck },
        { label: 'Student Progression', href: '/students/progression', icon: GraduationCap },
        { label: 'Classes & Cohorts', href: '/timetable/cohorts', icon: School },
      ],
    },
    {
      title: 'Assessment & Marks Workflow',
      description: 'Manage online markbooks, Excel marksheets, rules, and result publication.',
      icon: ClipboardList,
      color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      links: [
        { label: 'Assessment Control Centre', href: '/assessment', icon: ShieldCheck, badge: 'Overview' },
        { label: 'Markbook Management', href: '/assessment/assessments', icon: ClipboardList },
        { label: 'Performance & Reports', href: '/assessment/reports', icon: BarChart3 },
      ],
    },
    {
      title: 'Class Attendance & Oversight',
      description: 'Monitor live session attendance, analytics, and authorized mark revisions.',
      icon: Stethoscope,
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      links: [
        { label: 'Class Attendance Registry', href: '/attendance', icon: Stethoscope },
        { label: 'Attendance Reopen Oversight', href: '/operations/attendance', icon: ClipboardCheck },
      ],
    },
    {
      title: 'Curriculum & Teaching Documents',
      description: 'Standardised Course Outlines, Schemes of Work, and Records of Work.',
      icon: FileText,
      color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      links: [
        { label: 'Teaching Documents', href: '/teaching-documents', icon: FileText, badge: 'Documents' },
        { label: 'Curriculum Content', href: '/teaching-documents/curriculum', icon: BookOpen, badge: '14 Weeks' },
        { label: 'Syllabus Editor', href: '/teaching-documents/curriculum/editor', icon: FileSpreadsheet, badge: 'Word Upload' },
        { label: 'Trainer Document Review', href: '/teaching-documents/review', icon: FileCheck2 },
        { label: 'Published Documents', href: '/teaching-documents/published', icon: ShieldCheck },
        { label: 'Student Released Documents', href: '/teaching-documents/releases', icon: ShieldCheck },
      ],
    },
    {
      title: 'Setup & Master Data',
      description: 'Import master data, setup academic calendar, programmes, units & rooms.',
      icon: Building2,
      color: 'bg-slate-500/10 text-slate-700 border-slate-500/20',
      links: [
        { label: 'Bulk Excel Imports', href: '/timetable/imports', icon: FileSpreadsheet, badge: 'Excel Import' },
        { label: 'Schools & Departments', href: '/timetable/organization', icon: Building2 },
        { label: 'Academic Years & Periods', href: '/timetable/academic-periods', icon: CalendarDays },
        { label: 'Programmes & Units', href: '/timetable/programmes', icon: BookOpen },
        { label: 'Curriculum Unit Offerings', href: '/timetable/unit-offerings', icon: Presentation },
        { label: 'Trainers & Availability', href: '/timetable/trainers', icon: UsersRound },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Quick Navigation Actions */}
      <PageHeader
        eyebrow="Department Operations"
        title="Admin Control Centre"
        description="Quick access dashboard for all academic planning, assessment, attendance, and document workflows."
        context={
          <div className="flex items-center gap-2">
            <Badge variant="institutional">
              {profile.departmentName || 'Department'}
            </Badge>
            {snapshot?.activePeriodName && (
              <Badge variant="neutral">{snapshot.activePeriodName}</Badge>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/staff"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary/20"
            >
              <UserRound className="size-3.5" aria-hidden="true" />
              My Staff Workspace
            </Link>
            <Link
              href="/reports"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
            >
              <BarChart3 className="size-3.5" aria-hidden="true" />
              Executive Reports
            </Link>
            <Link
              href="/operations/action-center"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary-hover"
            >
              <Activity className="size-3.5" aria-hidden="true" />
              Action Centre
            </Link>
          </div>
        }
      />

      {/* Top Department Key Performance Indicators */}
      {snapshot && (
        <section aria-label="Department Metrics" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Active Period"
            value={formatPeriodDisplay(snapshot.activePeriodName)}
            description={snapshot.activePeriodName || 'Current academic session'}
            icon={CalendarDays}
          />
          <MetricCard
            label="Students"
            value={`${snapshot.students.registered} / ${snapshot.students.eligible}`}
            description={`${snapshot.students.portalActive} portal access active`}
            icon={GraduationCap}
          />
          <MetricCard
            label="Allocations"
            value={String(snapshot.timetable.activeAllocations)}
            description={`${snapshot.timetable.publishedSessions} published sessions`}
            icon={Presentation}
          />
          <MetricCard
            label="Assessments"
            value={`${snapshot.assessment.finalised} / ${snapshot.assessment.total}`}
            description={`${snapshot.assessment.published} results published`}
            icon={ClipboardList}
          />
          <MetricCard
            label="Class Attendance"
            value={`${snapshot.attendance.completed} Logged`}
            description={
              snapshot.attendance.open > 0
                ? `${snapshot.attendance.open} open session${snapshot.attendance.open === 1 ? '' : 's'}`
                : 'All sessions completed'
            }
            icon={Stethoscope}
          />
        </section>
      )}

      {/* Categorized Quick Access Grid */}
      <section aria-label="Admin Navigation Sections" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const HeaderIcon = section.icon;

          return (
            <Card key={section.title} className="flex flex-col overflow-hidden transition hover:border-border-strong shadow-xs">
              <CardHeader className="p-4 border-b border-border bg-surface-subtle/40">
                <div className="flex items-center gap-3">
                  <span className={`flex size-9 items-center justify-center rounded-lg border ${section.color}`}>
                    <HeaderIcon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <CardTitle className="text-sm font-bold text-text-primary">
                      {section.title}
                    </CardTitle>
                    <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">
                      {section.description}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-3 flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  {section.links.map((link) => {
                    const LinkIcon = link.icon;

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="group flex items-center justify-between rounded-lg p-2 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <LinkIcon className="size-3.5 text-text-muted group-hover:text-primary shrink-0" aria-hidden="true" />
                          <span className="truncate">{link.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {link.badge && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                              {link.badge}
                            </span>
                          )}
                          <ChevronRight className="size-3 text-text-muted opacity-0 transition group-hover:opacity-100 group-hover:translate-x-0.5" aria-hidden="true" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
