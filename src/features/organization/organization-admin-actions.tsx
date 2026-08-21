'use client';

import {
  Building2,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import {
  useRouter,
} from 'next/navigation';
import {
  FormEvent,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  assignDepartmentMemberAction,
  createAcademicWorkspaceAction,
} from './actions';

interface ProfileOption {
  id: string;
  fullName: string;
  email: string;
}

interface WorkspaceOption {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface OrganizationAdminActionsProps {
  profiles: ProfileOption[];
  workspaces: WorkspaceOption[];
}

export function OrganizationAdminActions({
  profiles,
  workspaces,
}: OrganizationAdminActionsProps) {
  const router = useRouter();

  const [workspaceOpen, setWorkspaceOpen] =
    useState(false);

  const [accessOpen, setAccessOpen] =
    useState(false);

  const [workspacePending, setWorkspacePending] =
    useState(false);

  const [accessPending, setAccessPending] =
    useState(false);

  const [workspaceError, setWorkspaceError] =
    useState<string | null>(null);

  const [accessError, setAccessError] =
    useState<string | null>(null);

  async function createWorkspace(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setWorkspaceError(null);
    setWorkspacePending(true);

    try {
      await createAcademicWorkspaceAction(formData);
      form.reset();
      setWorkspaceOpen(false);
      router.refresh();
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : 'Unable to add the workspace.',
      );
    } finally {
      setWorkspacePending(false);
    }
  }

  async function saveAccess(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setAccessError(null);
    setAccessPending(true);

    try {
      await assignDepartmentMemberAction(formData);
      form.reset();
      setAccessOpen(false);
      router.refresh();
    } catch (error) {
      setAccessError(
        error instanceof Error
          ? error.message
          : 'Unable to save workspace access.',
      );
    } finally {
      setAccessPending(false);
    }
  }

  return (
    <>
      <Dialog
        open={accessOpen}
        onOpenChange={(open) => {
          setAccessOpen(open);

          if (!open) {
            setAccessError(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={
              <ShieldCheck
                className="size-3.5"
                aria-hidden="true"
              />
            }
          >
            Workspace access
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-xl">
          <form onSubmit={saveAccess}>
            <DialogHeader>
              <DialogTitle>
                Workspace access
              </DialogTitle>
              <DialogDescription>
                Assign a user to a school or department.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-3">
              <Field label="User">
                <Select
                  name="profileId"
                  required
                  defaultValue=""
                >
                  <option value="">
                    Select user
                  </option>

                  {profiles.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.fullName} - {user.email}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="School / department">
                <Select
                  name="departmentId"
                  required
                  defaultValue=""
                >
                  <option value="">
                    Select school / department
                  </option>

                  {workspaces
                    .filter(
                      (workspace) =>
                        workspace.is_active,
                    )
                    .map((workspace) => (
                      <option
                        key={workspace.id}
                        value={workspace.id}
                      >
                        {workspace.name}
                      </option>
                    ))}
                </Select>
              </Field>

              <Field label="Access level">
                <Select
                  name="membershipRole"
                  required
                  defaultValue="hod"
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
                </Select>
              </Field>

              <label className="flex items-center gap-2 pt-1 text-sm text-text-secondary">
                <Checkbox name="isPrimary" />
                Primary workspace
              </label>

              {accessError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger"
                >
                  {accessError}
                </p>
              ) : null}
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setAccessOpen(false)
                }
                disabled={accessPending}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={
                  accessPending ||
                  profiles.length === 0 ||
                  workspaces.length === 0
                }
                leadingIcon={
                  <ShieldCheck
                    className="size-4"
                    aria-hidden="true"
                  />
                }
              >
                {accessPending
                  ? 'Saving...'
                  : 'Save access'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={workspaceOpen}
        onOpenChange={(open) => {
          setWorkspaceOpen(open);

          if (!open) {
            setWorkspaceError(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            size="sm"
            leadingIcon={
              <Plus
                className="size-3.5"
                aria-hidden="true"
              />
            }
          >
            Add school / department
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-lg">
          <form onSubmit={createWorkspace}>
            <DialogHeader>
              <DialogTitle>
                Add school / department
              </DialogTitle>
              <DialogDescription>
                Create an independent timetable workspace.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-3">
              <Field label="Code">
                <Input
                  name="code"
                  required
                  autoComplete="off"
                  placeholder="e.g. HND"
                  leadingContent={
                    <Building2
                      className="size-4"
                      aria-hidden="true"
                    />
                  }
                />
              </Field>

              <Field label="Official name">
                <Input
                  name="name"
                  required
                  autoComplete="off"
                  placeholder="School / department name"
                />
              </Field>

              {workspaceError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger"
                >
                  {workspaceError}
                </p>
              ) : null}
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setWorkspaceOpen(false)
                }
                disabled={workspacePending}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={workspacePending}
                leadingIcon={
                  <Plus
                    className="size-4"
                    aria-hidden="true"
                  />
                }
              >
                {workspacePending
                  ? 'Adding...'
                  : 'Add workspace'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold text-text-primary">
      <span className="mb-1.5 block">
        {label}
      </span>

      {children}
    </label>
  );
}
