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
    title: 'Academic Planning & Timetabling',
    shortTitle: 'Timetabling',
    description:
      'Plan teaching periods, allocate trainers, generate conflict-aware timetables and publish approved schedules.',
    href: '/timetable/readiness',
    status: 'active',
    icon: CalendarRange,
    capabilities: ['Academic setup', 'Teaching allocations', 'Timetable generation', 'Publication & reports'],
  },
  {
    key: 'students',
    title: 'Student Lifecycle & Registration',
    shortTitle: 'Students',
    description:
      'Maintain the authoritative student registry, academic progression, cohort movement and unit registration.',
    href: '/students',
    status: 'active',
    icon: GraduationCap,
    capabilities: ['Student registry', 'Progression history', 'Unit registration', 'Lifecycle reporting'],
  },
  {
    key: 'assessment',
    title: 'Assessment & Academic Performance',
    shortTitle: 'Assessment',
    description:
      'Manage CAT and examination populations, results, absences, analysis and academic performance reporting.',
    href: '/assessment',
    status: 'active',
    icon: ClipboardList,
    capabilities: ['CAT analysis', 'Exam analysis', 'Assessment attendance', 'Performance reports'],
  },
  {
    key: 'attendance',
    title: 'Attendance, Clinical Training & Progression',
    shortTitle: 'Attendance & Clinical',
    description:
      'Connect class attendance with clinical rotations, attachment readiness and programme completion milestones.',
    href: '/attendance-clinical',
    status: 'coming_soon',
    icon: Stethoscope,
    capabilities: ['Class attendance', 'Clinical rotations', 'Attachment readiness', 'Completion tracking'],
  },
] as const;
