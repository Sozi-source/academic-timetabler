'use client';

import {
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  type ReactNode,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';

interface ResetStudentPasswordDialogProps {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  trigger?: ReactNode;
}

export function ResetStudentPasswordDialog({
  studentId,
  studentName,
  admissionNumber,
  trigger,
}: ResetStudentPasswordDialogProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function resetForm() {
    setCustomPassword('');
    setError(null);
    setResult(null);
    setCopied(false);
  }

  function close() {
    if (saving) return;
    setOpen(false);
    resetForm();
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard failure
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmed = customPassword.trim();
    if (trimmed.length > 0 && trimmed.length < 4) {
      setError('Custom password must be at least 4 characters.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/students/${studentId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmed || undefined }),
      });

      const data: { success?: boolean; password?: string; message?: string; error?: string } =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message || data.error || 'Network error resetting student password.');
        return;
      }

      setResult(data.password ?? '');
      router.refresh();
    } catch {
      setError('Network error resetting student password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="contents cursor-pointer">
          {trigger}
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          leadingIcon={<KeyRound className="size-3.5" />}
        >
          Reset Password
        </Button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-student-pwd-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                  <KeyRound className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3
                    id="reset-student-pwd-title"
                    className="text-sm font-bold text-gray-900"
                  >
                    Reset student password
                  </h3>
                  <p className="text-xs text-gray-500">
                    {studentName} · {admissionNumber}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="mt-4 space-y-4">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs font-medium text-red-800">
                  {error}
                </div>
              )}

              {result ? (
                /* ── Success State ── */
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-700">
                    Password reset successfully. Share this with the student:
                  </p>
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
                    <span className="font-mono text-sm font-bold tracking-wide text-gray-900">
                      {result}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(result)}
                      className="ml-3 inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    The student can log in using their admission number and this
                    password.
                  </p>
                  <Button type="button" onClick={close} className="w-full">
                    Close
                  </Button>
                </div>
              ) : (
                /* ── Form State ── */
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="student-custom-pwd"
                      className="block text-xs font-bold text-gray-700"
                    >
                      Custom password{' '}
                      <span className="font-normal text-gray-400">
                        (Optional)
                      </span>
                    </label>
                    <input
                      id="student-custom-pwd"
                      type="text"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="student"
                      disabled={saving}
                      autoComplete="off"
                      className="mt-1.5 h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-xs text-gray-900 shadow-2xs placeholder:text-gray-400 focus:border-[#033B36] focus:outline-none focus:ring-1 focus:ring-[#033B36]"
                    />
                    <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed">
                      If left blank, the system will generate a secure temporary
                      password (e.g.{' '}
                      <code className="font-mono">Icmhs@xxxx</code>) that you
                      can copy.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={close}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={saving}
                      leadingIcon={
                        saving ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          <KeyRound className="size-3.5" />
                        )
                      }
                    >
                      {saving ? 'Resetting…' : 'Reset password'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
