import {
  Building2,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
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
    <div className="space-y-5">
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
        <section className="grid gap-3 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-text-primary">
                Add school / department
              </h2>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                Enter the name once. The system creates the matching internal records automatically.
              </p>
            </CardHeader>
            <CardContent>
              <form
                action={createAcademicWorkspaceAction}
                className="space-y-3"
              >
                <Input
                  name="code"
                  required
                  placeholder="Code, for example HND"
                />
                <Input
                  name="name"
                  required
                  placeholder="Official school / department name"
                />
                <Button type="submit" leadingIcon={<Plus className="size-4" aria-hidden="true" />}>
                  Add workspace
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-text-primary">
                Workspace access
              </h2>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                Choose which school or department a user may manage.
              </p>
            </CardHeader>
            <CardContent>
              <form
                action={assignDepartmentMemberAction}
                className="space-y-3"
              >
                <Select name="profileId" required defaultValue="">
                  <option value="">Select user</option>
                  {profiles.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.fullName} — {user.email}
                    </option>
                  ))}
                </Select>
                <Select name="departmentId" required defaultValue="">
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
                </Select>
                <Select name="membershipRole" required defaultValue="hod">
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
                </Select>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <Checkbox name="isPrimary" />
                  Make this the user&apos;s primary workspace
                </label>
                <Button type="submit" leadingIcon={<ShieldCheck className="size-4" aria-hidden="true" />}>
                  Save access
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      ) : (
        <Card className="p-4 text-sm text-text-secondary">
          You can view your authorized school or department workspace. A system administrator creates workspaces and assigns access.
        </Card>
      )}

      {workspaces.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card key={workspace.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Building2
                    className="size-4"
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-text-primary">
                    {workspace.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-text-muted">
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
              <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                <Users
                  className="size-3.5 text-primary"
                  aria-hidden="true"
                />
                Independent timetable workspace
              </div>
            </Card>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={Building2}
          title="No workspace registered"
          description="No school or department workspace has been registered."
        />
      )}
    </div>
  );
}
