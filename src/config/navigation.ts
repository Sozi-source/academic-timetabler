import {
  BookOpen,
  Building2,
  CalendarDays,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  Presentation,
  School,
  Sparkles,
  UserRound,
} from 'lucide-react';

export const dashboardNavigation = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Academic periods',
    href: '/timetable/academic-periods',
    icon: CalendarDays,
  },
  {
    label: 'Time slots',
    href: '/timetable/time-slots',
    icon: Clock3,
  },
  {
    label: 'Rooms',
    href: '/timetable/rooms',
    icon: Building2,
  },
  {
    label: 'Programmes',
    href: '/timetable/programmes',
    icon: GraduationCap,
  },
  {
    label: 'Cohorts',
    href: '/timetable/cohorts',
    icon: School,
  },
  {
    label: 'Units',
    href: '/timetable/units',
    icon: BookOpen,
  },
  {
    label: 'Trainers',
    href: '/timetable/trainers',
    icon: UserRound,
  },
  {
    label: 'Teaching allocations',
    href: '/timetable/teaching-allocations',
    icon: Presentation,
  },
  {
    label: 'Generate timetable',
    href: '/timetable/generator',
    icon: Sparkles,
  },
] as const;