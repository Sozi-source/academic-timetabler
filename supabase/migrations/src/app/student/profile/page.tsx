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

  return (
    <StudentPortalShell
      student={
        student
      }
    >
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
            Student details
          </p>

          <h1 className="mt-1 text-xl font-bold text-text-primary">
            Profile
          </h1>

          <p className="mt-1 text-xs text-text-muted">
            Review and confirm your details.
          </p>
        </div>

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

        {parameters.error ? (
          <div className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-[11px] text-danger">
            Profile could not be saved.
            Review the entered details.
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

              <p className="mt-0.5 text-[11px] text-text-muted">
                Contact the department if
                your academic identity is
                incorrect.
              </p>
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
              KCSE index number
              <Input
                name="kcseIndexNumber"
                defaultValue={
                  profile.kcseIndexNumber ??
                  ''
                }
                placeholder="12345678/001"
                className="mt-1 h-9"
              />
            </label>

            <label className="text-xs font-semibold text-text-primary">
              National ID number
              <Input
                name="nationalIdNumber"
                defaultValue={
                  profile.nationalIdNumber ??
                  ''
                }
                inputMode="numeric"
                className="mt-1 h-9"
              />
            </label>

            <label className="text-xs font-semibold text-text-primary">
              Phone number
              <Input
                name="phoneNumber"
                defaultValue={
                  profile.phoneNumber ??
                  ''
                }
                className="mt-1 h-9"
              />
            </label>

            <label className="text-xs font-semibold text-text-primary">
              Email
              <Input
                name="email"
                type="email"
                defaultValue={
                  profile.email ??
                  ''
                }
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
