import {
  ArrowLeft,
  BookOpen,
  Building2,
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

export const dashboardNavigation = [
  {
    label: 'Platform',
    items: [
      { label: 'Module Hub', href: '/dashboard', icon: ArrowLeft },
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
      { label: 'Trainers', href: '/timetable/trainers', icon: UserRound },
      { label: 'Allocations', href: '/timetable/teaching-allocations', icon: Presentation },
      { label: 'Rooms', href: '/timetable/rooms', icon: Building2 },
      { label: 'Constraints', href: '/timetable/constraints', icon: SlidersHorizontal },
      { label: 'Imports', href: '/timetable/imports', icon: FileSpreadsheet },
    ],
  },
] as const;
