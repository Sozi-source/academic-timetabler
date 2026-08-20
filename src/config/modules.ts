import {
  CalendarRange,
  ClipboardList,
  GraduationCap,
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
    shortTitle: 'Attendance & Clinical',
    description: 'Manage attendance and clinical progression.',
    href: '/attendance-clinical',
    status: 'coming_soon',
    icon: Stethoscope,
    capabilities: ['Class attendance', 'Clinical rotations', 'Attachment readiness', 'Completion tracking'],
  },
] as const;
