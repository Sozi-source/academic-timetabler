import {
  AlarmClock,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  FileChartColumn,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  PencilRuler,
  Presentation,
  School,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  UsersRound,
  Network,
} from 'lucide-react';

// Keep import and edit screens inside their parent registers so the main
// navigation remains complete without becoming difficult to scan.
export const dashboardNavigation = [
  {
    label: 'Home',
    items: [
      { label: 'Timetable home', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Create timetable',
    items: [
      { label: '1. Check readiness', href: '/timetable/readiness', icon: ClipboardCheck },
      { label: '2. Generate', href: '/timetable/generator', icon: Sparkles },
      { label: '3. Review and edit', href: '/timetable/editor', icon: PencilRuler },
      { label: '4. Publish', href: '/timetable/published', icon: FileChartColumn },
      { label: 'Reports', href: '/timetable/reports', icon: ListChecks },
    ],
  },
  {
    label: 'Calendar setup',
    items: [
      { label: 'Schools / departments', href: '/timetable/organization', icon: Network },
      { label: 'Academic years', href: '/timetable/academic-years', icon: CalendarDays },
      { label: 'Academic Periods', href: '/timetable/academic-periods', icon: CalendarRange },
      { label: 'Teaching sessions', href: '/timetable/time-slots', icon: AlarmClock },
    ],
  },
  {
    label: 'Teaching setup',
    items: [
      { label: 'Bulk imports', href: '/timetable/imports', icon: FileSpreadsheet },
      { label: 'Programmes', href: '/timetable/programmes', icon: GraduationCap },
      { label: 'Classes and cohorts', href: '/timetable/cohorts', icon: School },
      { label: 'Curriculum units', href: '/timetable/units', icon: BookOpen },
      { label: 'Units on offer', href: '/timetable/unit-offerings', icon: Presentation },
      { label: 'Trainers', href: '/timetable/trainers', icon: UserRound },
      { label: 'Trainer availability', href: '/timetable/trainers/availability', icon: UsersRound },
      { label: 'Rooms', href: '/timetable/rooms', icon: Building2 },
      { label: 'Teaching allocations', href: '/timetable/teaching-allocations', icon: Presentation },
      { label: 'Scheduling constraints', href: '/timetable/constraints', icon: SlidersHorizontal },
    ],
  },
] as const;
