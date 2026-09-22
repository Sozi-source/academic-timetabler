import { Download } from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { getStaffWorkspace } from '@/features/staff-assessment/queries';
import { StaffDownloadsView } from '@/features/staff-downloads/staff-downloads-view';

export default async function StaffDownloadsPage() {
  const profile = await requireTrainerAccess();
  const workspace = await getStaffWorkspace(profile.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Downloads"
        description="Printable registers and teaching files"
        icon={Download}
      />

      <StaffDownloadsView
        allocations={workspace.allocations}
        trainerName={workspace.trainerName}
      />
    </div>
  );
}
