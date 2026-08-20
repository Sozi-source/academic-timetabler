import { redirect } from 'next/navigation';
import { CheckCircle2, LogOut, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getStudentPortalSession } from '@/features/student-portal/session';
import { studentPortalLogout, verifyStudentProfile } from '@/features/student-portal/actions';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function StudentProfilePage() {
  const session = await getStudentPortalSession();
  if (!session) redirect('/student/login');
  const admin = createAdminClient();
  const { data: student } = await admin.from('students').select('admission_number,full_name,kcse_index_number,national_id_number,phone_number,email,details_verified_at').eq('id', session.studentId).maybeSingle();
  if (!student) redirect('/student/login');

  return <main className="min-h-screen bg-surface-subtle">
    <div className="border-t-4 border-accent bg-white shadow-sm"><div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3"><div><p className="text-sm font-bold text-text-primary">Academic Planning System</p><p className="text-[0.6875rem] text-text-muted">Verify your details</p></div><form action={studentPortalLogout}><Button type="submit" variant="ghost" size="sm"><LogOut className="size-4"/> Sign out</Button></form></div></div>
    <div className="mx-auto max-w-3xl px-5 py-5"><Card className="p-5"><div className="mb-4 flex items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-institutional-yellow text-institutional-yellow-ink"><ShieldCheck className="size-4"/></span><div><h1 className="text-base font-bold text-text-primary">Confirm your details</h1><p className="mt-0.5 text-xs text-text-muted">Correct any inaccurate information, then continue.</p></div></div>
      {student.details_verified_at ? <div className="mb-4 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-xs text-text-secondary"><CheckCircle2 className="size-4 text-success"/>Details verified previously. You may update them again.</div> : null}
      <form action={verifyStudentProfile} className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-text-primary">Admission number<Input value={student.admission_number} disabled className="mt-1 h-9"/></label>
        <label className="text-xs font-semibold text-text-primary">Full name<Input name="fullName" defaultValue={student.full_name} required className="mt-1 h-9"/></label>
        <label className="text-xs font-semibold text-text-primary">KCSE index number<Input name="kcseIndexNumber" defaultValue={student.kcse_index_number ?? ''} placeholder="12345678/001" className="mt-1 h-9"/></label>
        <label className="text-xs font-semibold text-text-primary">National ID number<Input name="nationalIdNumber" defaultValue={student.national_id_number ?? ''} inputMode="numeric" className="mt-1 h-9"/></label>
        <label className="text-xs font-semibold text-text-primary">Phone number<Input name="phoneNumber" defaultValue={student.phone_number ?? ''} className="mt-1 h-9"/></label>
        <label className="text-xs font-semibold text-text-primary">Email<Input name="email" type="email" defaultValue={student.email ?? ''} className="mt-1 h-9"/></label>
        <div className="md:col-span-2 flex justify-end border-t border-border pt-3"><Button type="submit">Save and continue</Button></div>
      </form>
    </Card></div>
  </main>;
}
