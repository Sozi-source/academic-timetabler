import {
  Building2,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  OrganizationAdminActions,
} from '@/features/organization/organization-admin-actions';
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
    <div className="space-y-4">
      <PageHeader
        title="Schools / Departments"
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
        actions={
          isSystemAdministrator ? (
            <OrganizationAdminActions
              profiles={profiles}
              workspaces={workspaces}
            />
          ) : undefined
        }
      />

      {!isSystemAdministrator ? (
        <Card className="p-4 text-sm text-text-secondary">
          You can view your authorized school or department workspace.
        </Card>
      ) : null}

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
