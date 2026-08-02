import {
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  Clock3,
  FileChartColumn,
  GraduationCap,
  LayoutDashboard,
  Presentation,
  School,
  Sparkles,
  ClipboardList,
  UserRound,
} from 'lucide-react';

export const dashboardNavigation = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'Academic calendar',
    items: [
      {
        label: 'Academic years',
        href: '/timetable/academic-years',
        icon: CalendarDays,
      },
      {
        label: 'Academic periods',
        href: '/timetable/academic-periods',
        icon: CalendarRange,
      },
      {
        label: 'Working days & time slots',
        href: '/timetable/time-slots',
        icon: Clock3,
      },
    ],
  },
  {
    label: 'Academic structure',
    items: [
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
    ],
  },
  {
    label: 'Resources',
    items: [
      {
        label: 'Trainers',
        href: '/timetable/trainers',
        icon: UserRound,
      },
      {
        label: 'Rooms',
        href: '/timetable/rooms',
        icon: Building2,
      },
    ],
  },
  {
    label: 'Scheduling',
    items: [
      {
        label: 'Units on Offer',
        href: '/timetable/unit-offerings',
        icon: ClipboardList,
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
      {
        label: 'Published timetables',
        href: '/timetable/published',
        icon: FileChartColumn,
      },
    ],
  },
] as const;