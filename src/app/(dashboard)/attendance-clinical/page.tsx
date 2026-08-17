import { Stethoscope } from 'lucide-react';
import { ModuleComingSoon } from '@/components/modules/module-coming-soon';
import { requireHodAccess } from '@/features/auth/authorization';
export default async function AttendanceClinicalModulePage() {
  await requireHodAccess();
  return <ModuleComingSoon title="Attendance, Clinical Training & Progression" description="Class attendance, clinical rotations, attachment readiness and programme completion milestones." icon={Stethoscope} capabilities={['Class attendance', 'Clinical rotations', 'Attachment readiness', 'Completion tracking']} />;
}
