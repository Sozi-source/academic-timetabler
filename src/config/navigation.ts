import {
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  Building2,
  CalendarRange,
  ClipboardCheck,
  FileChartColumn,
  FileSpreadsheet,
  GitMerge,
  ListChecks,
  PencilRuler,
  Presentation,
  School,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  UserRound,
  Users,
} from 'lucide-react';

export const dashboardNavigation = [
  {
    label: 'Platform',
    items: [
      { label: 'Module Hub', href: '/dashboard', icon: ArrowLeft },
      { label: 'Student Registry', href: '/students/registry', icon: Users },
      { label: 'Staff & Trainers', href: '/trainers', icon: UserRound },
      { label: 'Unit Registration', href: '/students/unit-registration', icon: BookOpenCheck },
    ],
  },
  {
    label: 'Schedules',
    items: [
      { label: 'Generate Timetable', href: '/timetable/readiness', icon: ClipboardCheck },
      { label: 'Review & Edit', href: '/timetable/editor', icon: PencilRuler },
      { label: 'Publications', href: '/timetable/published', icon: FileChartColumn },
      { label: 'Reports', href: '/timetable/reports', icon: ListChecks },
    ],
  },
  {
    label: 'Master Setup',
    items: [
      { label: 'Academic Periods', href: '/timetable/academic-periods', icon: CalendarRange },
      { label: 'Programmes', href: '/timetable/cohorts', icon: School },
      { label: 'Unit Offerings', href: '/timetable/unit-offerings', icon: BookOpen },
      { label: 'Unit Equivalence', href: '/timetable/unit-equivalence', icon: GitMerge },
      { label: 'Trainers', href: '/timetable/trainers', icon: UserRound },
      { label: 'Allocations', href: '/timetable/teaching-allocations', icon: Presentation },
      { label: 'Rooms', href: '/timetable/rooms', icon: Building2 },
      { label: 'Constraints', href: '/timetable/constraints', icon: SlidersHorizontal },
      { label: 'Imports', href: '/timetable/imports', icon: FileSpreadsheet },
    ],
  },
] as const;
