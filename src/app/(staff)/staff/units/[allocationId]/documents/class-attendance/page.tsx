import { notFound } from 'next/navigation';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { requireStaffAllocation } from '@/features/staff-assessment/queries';
import { getAllocationPopulationWorkspace } from '@/features/assessment/population-workspace';
import { PrintableClassRegister } from '@/features/class-attendance/printable-class-register';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{
    allocationId: string;
  }>;
}

export default async function ClassAttendancePage({ params }: PageProps) {
  const profile = await requireTrainerAccess();
  const { allocationId } = await params;

  const [context, population, supabase] = await Promise.all([
    requireStaffAllocation({
      profileId: profile.id,
      allocationId,
    }),
    getAllocationPopulationWorkspace(allocationId),
    createClient(),
  ]);

  if (!context) {
    notFound();
  }

  // Load Programme, Department, and Timetable Venue
  const { data: allocMeta } = await supabase
    .from('teaching_allocations')
    .select(`
      id,
      cohorts (
        id,
        name,
        programmes (
          id,
          name,
          departments (
            id,
            name
          )
        )
      )
    `)
    .eq('id', allocationId)
    .maybeSingle();

  const { data: slot } = await supabase
    .from('timetable_slots')
    .select(`
      room:rooms (
        name,
        code
      )
    `)
    .eq('allocation_id', allocationId)
    .limit(1)
    .maybeSingle();

  const cohortData = (allocMeta as any)?.cohorts;
  const programmeData = cohortData?.programmes;
  const departmentData = programmeData?.departments;

  const departmentName = departmentData?.name || 'Applied Science';
  const programmeName = programmeData?.name || 'Diploma in Science Laboratory Technology';
  const venueName = (slot as any)?.room ? `${(slot as any).room.name || ''} ${(slot as any).room.code ? `(${(slot as any).room.code})` : ''}`.trim() : 'THK 2- 06/08';

  return (
    <PrintableClassRegister
      allocationId={allocationId}
      unitCode={context.allocation.unitCode}
      unitName={context.allocation.unitName}
      cohortName={context.allocation.cohortName}
      periodName={context.allocation.academicPeriodName}
      trainerName={context.workspace.trainerName}
      schoolName="Imperial"
      departmentName={departmentName}
      programmeName={programmeName}
      venueName={venueName}
      students={population.students.map((s) => ({
        studentId: s.studentId,
        admissionNumber: s.admissionNumber,
        fullName: s.fullName,
      }))}
    />
  );
}
