import { notFound } from 'next/navigation';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { requireStaffAllocation } from '@/features/staff-assessment/queries';
import { getAllocationPopulationWorkspace } from '@/features/assessment/population-workspace';
import { PrintableSigningSheet } from '@/features/assessment/printable-signing-sheet';
import { getAttendanceSheetMetadata } from '@/features/assessment/attendance-sheet-data';

interface PageProps {
  params: Promise<{
    allocationId: string;
  }>;
}

export default async function ExamAttendancePage({ params }: PageProps) {
  const profile = await requireTrainerAccess();
  const { allocationId } = await params;

  const [context, population, metadata] = await Promise.all([
    requireStaffAllocation({
      profileId: profile.id,
      allocationId,
    }),
    getAllocationPopulationWorkspace(allocationId),
    getAttendanceSheetMetadata(allocationId),
  ]);

  if (!context) {
    notFound();
  }

  return (
    <PrintableSigningSheet
      type="exam"
      allocationId={allocationId}
      unitCode={context.allocation.unitCode}
      unitName={context.allocation.unitName}
      cohortName={population.cohort?.name || context.allocation.cohortName}
      periodName={context.allocation.academicPeriodName}
      trainerName={context.workspace.trainerName}
      institutionName={metadata.institutionName}
      campusName={metadata.campusName}
      schoolName={metadata.schoolName}
      departmentName={metadata.departmentName}
      programmeName={metadata.programmeName}
      venueName={metadata.venueName}
      candidates={population.students.map((s) => ({
        studentId: s.studentId,
        admissionNumber: s.admissionNumber,
        fullName: s.fullName,
      }))}
    />
  );
}
