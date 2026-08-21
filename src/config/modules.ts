import {
  CalendarRange,
  ClipboardList,
  GraduationCap,
  FlaskConical,
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
    key: 'attendance',
    title: 'Attendance & Clinical',
    shortTitle: 'Attendance',
    description: 'Monitor class attendance; clinical workflows remain staged.',
    href: '/attendance-clinical',
    status: 'active',
    icon: Stethoscope,
    capabilities: ['Class attendance', 'Present / absent', 'Trainer history', 'HOD oversight'],
  },
  {
    key: 'testing',
    title: 'System Testing',
    shortTitle: 'Testing',
    description: 'Launch structured end-to-end testing before production.',
    href: '/testing',
    status: 'active',
    icon: FlaskConical,
    capabilities: ['Module readiness', 'Test launchpad', 'Operational counts', 'Pre-production review'],
  },
] as const;
