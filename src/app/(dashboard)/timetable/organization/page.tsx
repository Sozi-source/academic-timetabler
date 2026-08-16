import {
  Building2,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  assignDepartmentMemberAction,
  createAcademicWorkspaceAction,
} from '@/features/organization/actions';
import {
  getOrganizationProfiles,
  getOrganizationStructure,
} from '@/features/organization/queries';

export const dynamic = 'force-dynamic';

const controlClassName =
  'h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary';

export default async function OrganizationPage() {
  const profile = await requireHodAccess();
  const isSystemAdministrator =
    profile.role === 'system_admin';
  const [workspaces, profiles] =
    await Promise.all([
      getOrganizationStructure(),
      isSystemAdministrator
        ? getOrganizationProfiles()
        : Promise.resolve([]),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Institution setup"
        title="Schools / Departments"
        description="Register each school or department once. The same name becomes its independent timetable workspace."
        context={
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">
              {workspaces.length}{' '}
              {workspaces.length === 1
                ? 'workspace'
                : 'workspaces'}
            </Badge>
            <Badge variant="success" dot>
              {
                workspaces.filter(
                  (workspace) =>
                    workspace.is_active,
                ).length
              }{' '}
              active
            </Badge>
          </div>
        }
      />

      {isSystemAdministrator ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <form
            action={createAcademicWorkspaceAction}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <h2 className="font-semibold text-text-primary">
              Add school / department
            </h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              Enter the name once. The system creates the matching internal records automatically.
            </p>
            <div className="mt-4 space-y-3">
              <input
                name="code"
                required
                placeholder="Code, for example HND"
                className={controlClassName}
              />
              <input
                name="name"
                required
                placeholder="Official school / department name"
                className={controlClassName}
              />
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
              >
                <Plus
                  className="mr-2 size-4"
                  aria-hidden="true"
                />
                Add workspace
              </button>
            </div>
          </form>

          <form
            action={assignDepartmentMemberAction}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <h2 className="font-semibold text-text-primary">
              Workspace access
            </h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              Choose which school or department a user may manage.
            </p>
            <div className="mt-4 space-y-3">
              <select
                name="profileId"
                required
                className={controlClassName}
              >
                <option value="">Select user</option>
                {profiles.map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.fullName} — {user.email}
                  </option>
                ))}
              </select>
              <select
                name="departmentId"
                required
                className={controlClassName}
              >
                <option value="">
                  Select school / department
                </option>
                {workspaces.map((workspace) => (
                  <option
                    key={workspace.id}
                    value={workspace.id}
                  >
                    {workspace.name}
                  </option>
                ))}
              </select>
              <select
                name="membershipRole"
                required
                className={controlClassName}
              >
                <option value="hod">
                  Head of Department
                </option>
                <option value="timetable_officer">
                  Timetable officer
                </option>
                <option value="school_admin">
                  Workspace administrator
                </option>
                <option value="staff">
                  View-only staff
                </option>
              </select>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  name="isPrimary"
                  type="checkbox"
                />
                Make this the user&apos;s primary workspace
              </label>
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
              >
                <ShieldCheck
                  className="mr-2 size-4"
                  aria-hidden="true"
                />
                Save access
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="rounded-2xl border border-border bg-surface-subtle p-4 text-sm text-text-secondary">
          You can view your authorized school or department workspace. A system administrator creates workspaces and assigns access.
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {workspaces.map((workspace) => (
          <article
            key={workspace.id}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Building2
                  className="size-5"
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-text-primary">
                  {workspace.name}
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  {workspace.code}
                </p>
              </div>
              <Badge
                variant={
                  workspace.is_active
                    ? 'success'
                    : 'neutral'
                }
              >
                {workspace.is_active
                  ? 'Active'
                  : 'Inactive'}
              </Badge>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">
              <Users
                className="size-4 text-primary"
                aria-hidden="true"
              />
              Independent timetable workspace
            </div>
          </article>
        ))}
      </section>

      {workspaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface-subtle p-8 text-center text-sm text-text-muted">
          No school or department workspace has been registered.
        </div>
      ) : null}
    </div>
  );
}
