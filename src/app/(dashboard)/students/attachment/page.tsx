import { Briefcase } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getNextSemesterAttachmentData } from '@/features/students/attachment-eligibility';
import { AttachmentEligibilityWorkspace } from '@/features/students/attachment-eligibility-workspace';

export default async function StudentAttachmentEligibilityPage() {
  await requireHodAccess();
  const data = await getNextSemesterAttachmentData();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Student Lifecycle"
        title="Next semester attachment list"
        icon={Briefcase}
        context={
          <Badge variant="neutral">
            {data.candidates.length} due next semester
          </Badge>
        }
      />

      <AttachmentEligibilityWorkspace
        departmentName={data.departmentName}
        rules={data.rules}
        initialCandidates={data.candidates}
        otherActiveStudents={data.otherActiveStudents}
      />
    </div>
  );
}
