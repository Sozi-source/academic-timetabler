import {
  CalendarRange,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';

export type PlatformModuleStatus = 'active' | 'coming_soon';

export interface PlatformModule {
  key: string;
  title: string;
  shortTitle: string;
  description: string;
  href: string;
  status: PlatformModuleStatus;
  icon: LucideIcon;
  capabilities: readonly string[];
}

export const platformModules: readonly PlatformModule[] = [
  {
    key: 'timetabling',
    title: 'Timetabling',
    shortTitle: 'Timetabling',
    description: 'Plan and publish teaching schedules.',
    href: '/timetable/readiness',
    status: 'active',
    icon: CalendarRange,
    capabilities: ['Academic setup', 'Teaching allocations', 'Timetable generation', 'Publication & reports'],
  },
  {
    key: 'students',
    title: 'Students',
    shortTitle: 'Students',
    description: 'Manage students, progression and registration.',
    href: '/students',
    status: 'active',
    icon: GraduationCap,
    capabilities: ['Student registry', 'Progression history', 'Unit registration', 'Lifecycle reporting'],
  },
  {
    key: 'assessment',
    title: 'Assessment',
    shortTitle: 'Assessment',
    description: 'Manage assessments, marks and performance.',
    href: '/assessment',
    status: 'active',
    icon: ClipboardList,
    capabilities: ['CAT analysis', 'Exam analysis', 'Assessment attendance', 'Performance reports'],
  },
  {
    key: 'operations',
    title: 'Operations & QA',
    shortTitle: 'Operations',
    description: 'Review operational readiness and release controls.',
    href: '/operations',
    status: 'active',
    icon: ShieldCheck,
    capabilities: ['Release readiness', 'Attendance oversight', 'Student document release', 'Operational QA'],
  },
  {
    key: 'attendance',
    title: 'Class Attendance',
    shortTitle: 'Attendance',
    description: 'Monitor trainer compliance and student attendance across all units.',
    href: '/attendance',
    status: 'active',
    icon: Stethoscope,
    capabilities: ['Class attendance', 'Attendance analytics', 'Student attendance', 'Trainer compliance'],
  },
] as const;
