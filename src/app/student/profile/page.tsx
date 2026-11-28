import {
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import {
  redirect,
} from 'next/navigation';

import {
  StudentPortalShell,
} from '@/components/student/student-portal-shell';
import {
  Badge,
} from '@/components/ui/badge';
import {
  Button,
} from '@/components/ui/button';
import {
  Card,
} from '@/components/ui/card';
import {
  Input,
} from '@/components/ui/input';
import {
  verifyStudentProfile,
} from '@/features/student-portal/actions';
import { getMissingKnecBiodataFields } from '@/features/student-portal/profile';
import {
  getStudentPortalIdentity,
  getStudentPortalProfileDetails,
} from '@/features/student-portal/queries';
import {
  getStudentPortalSession,
} from '@/features/student-portal/session';

export default async function StudentProfilePage({
  searchParams,
}: {
  searchParams:
    Promise<{
      saved?:
        string;
      error?:
        string;
    }>;
}) {
  const session =
    await getStudentPortalSession();

  if (!session) {
    redirect(
      '/student/login',
    );
  }

  const [
    student,
    profile,
    parameters,
  ] =
    await Promise.all([
      getStudentPortalIdentity(
        session.studentId,
      ),
      getStudentPortalProfileDetails(
        session.studentId,
      ),
      searchParams,
    ]);

  if (
    !student ||
    !profile
  ) {
    redirect(
      '/student/login',
    );
  }

  const missingKnecFields = getMissingKnecBiodataFields(profile);
  const errorMessage =
    parameters.error === 'save'
      ? 'Profile could not be saved. Review the entered details.'
      : parameters.error && parameters.error !== 'invalid'
        ? parameters.error
        : parameters.error === 'invalid'
          ? 'Please enter valid values for all required fields.'
          : null;

  return (
    <StudentPortalShell
      student={
        student
      }
    >
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Header Banner */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-2xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary-soft text-primary font-bold">
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Student Record
              </p>
            </div>
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
              Student Profile
            </h1>
            <p className="text-xs text-text-muted">
              {student.programmeName} · <span className="font-mono">{student.admissionNumber}</span>
            </p>
          </div>

          <Badge variant={profile.detailsVerifiedAt ? 'success' : 'warning'} className="px-3 py-1 text-xs font-semibold">
            {profile.detailsVerifiedAt ? 'Verified Record' : 'Pending Verification'}
          </Badge>
        </section>

        {parameters.saved ===
        '1' ? (
          <div className="flex items-center gap-2 rounded-lg border border-success-border bg-success-surface px-3 py-2.5 text-[11px] text-success">
            <CheckCircle2
              className="size-3.5"
              aria-hidden="true"
            />
            Profile updated.
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-[11px] text-danger">
            {errorMessage}
          </div>
        ) : null}

        {missingKnecFields.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900">
            <strong>Required before KNEC Module I booking:</strong> Complete{' '}
            {missingKnecFields.join(', ')}. These details stay strictly in your profile and are not printed on KNEC clearance forms.
          </div>
        ) : null}

        <Card className="p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-institutional-yellow text-institutional-yellow-ink">
              <ShieldCheck
                className="size-4"
                aria-hidden="true"
              />
            </span>

            <div>
              <h2 className="text-sm font-bold text-text-primary">
                Confirm your details
              </h2>

            </div>
          </div>

          {profile.detailsVerifiedAt ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-[11px] text-text-secondary">
              <CheckCircle2
                className="size-4 text-success"
                aria-hidden="true"
              />
              Details verified previously.
            </div>
          ) : null}

          <form
            action={
              verifyStudentProfile
            }
            className="grid gap-3 md:grid-cols-2"
          >
            <label className="text-xs font-semibold text-text-primary">
              Admission number
              <Input
                value={
                  profile.admissionNumber
                }
                disabled
                className="mt-1 h-9"
              />
            </label>

            <label className="text-xs font-semibold text-text-primary">
              Full name
              <Input
                name="fullName"
                defaultValue={
                  profile.fullName
                }
                required
                className="mt-1 h-9"
              />
            </label>

            <label className="text-xs font-semibold text-text-primary">
              KCSE index number <span className="text-rose-600" aria-hidden="true">*</span>
              <Input
                name="kcseIndexNumber"
                defaultValue={profile.kcseIndexNumber ?? ''}
                placeholder="12345678/001"
                required
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="mt-1 h-9"
              />
            </label>

            <label className="text-xs font-semibold text-text-primary">
              National ID number <span className="text-rose-600" aria-hidden="true">*</span>
              <Input
                name="nationalIdNumber"
                defaultValue={profile.nationalIdNumber ?? ''}
                inputMode="numeric"
                required
                autoCorrect="off"
                spellCheck={false}
                className="mt-1 h-9"
              />
            </label>

            <label className="text-xs font-semibold text-text-primary">
              Phone number <span className="text-rose-600" aria-hidden="true">*</span>
              <Input
                name="phoneNumber"
                type="tel"
                defaultValue={profile.phoneNumber ?? ''}
                required
                className="mt-1 h-9"
              />
            </label>

            <label className="text-xs font-semibold text-text-primary">
              Birth certificate entry number <span className="text-rose-600" aria-hidden="true">*</span>
              <Input
                name="birthCertificateEntryNumber"
                defaultValue={profile.birthCertificateEntryNumber ?? ''}
                placeholder="e.g. 0945123456"
                required
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="mt-1 h-9"
              />
            </label>

            <label className="text-xs font-semibold text-text-primary md:col-span-2">
              Email
              <Input
                name="email"
                type="email"
                defaultValue={profile.email ?? ''}
                className="mt-1 h-9"
              />
            </label>

            <div className="flex justify-end border-t border-border pt-3 md:col-span-2">
              <Button
                type="submit"
              >
                Save details
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </StudentPortalShell>
  );
}
