'use client';

import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/button';

interface ResetTrainerPasswordProps {
  trainerId: string;
  trainerName: string;
  trainerEmail?: string | null;
  buttonVariant?: ButtonVariant;
  buttonSize?: ButtonSize;
  buttonLabel?: string;
}

function generateRandomPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*';

  let pwd = '';
  for (let i = 0; i < 6; i++) pwd += letters.charAt(Math.floor(Math.random() * letters.length));
  for (let i = 0; i < 2; i++) pwd += numbers.charAt(Math.floor(Math.random() * numbers.length));
  for (let i = 0; i < 2; i++) pwd += symbols.charAt(Math.floor(Math.random() * symbols.length));

  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
}

export function ResetTrainerPassword({
  trainerId,
  trainerName,
  trainerEmail,
  buttonVariant = 'outline',
  buttonSize = 'sm',
  buttonLabel = 'Reset Password',
}: ResetTrainerPasswordProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function resetForm() {
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setCopied(false);
    setError(null);
    setSuccess(null);
  }

  function close() {
    if (saving) return;
    setOpen(false);
    resetForm();
  }

  function handleGenerate() {
    const generated = generateRandomPassword();
    setPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
    setError(null);
  }

  async function handleCopy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard write failure
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 8) {
      setError('Temporary password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/admin/trainers/${trainerId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update trainer password.');
      }

      setSuccess(data.message || 'Temporary password set successfully.');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to reset password. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5"
      >
        <KeyRound className="size-3.5" aria-hidden="true" />
        <span>{buttonLabel}</span>
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <KeyRound className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Set Temporary Password</h3>
                  <p className="text-xs text-gray-500">{trainerName}</p>
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

            {/* Content */}
            <div className="mt-4 space-y-4">
              {trainerEmail ? (
                <p className="text-xs text-gray-600">
                  Account login email: <strong className="font-semibold text-gray-900">{trainerEmail}</strong>
                </p>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
                  No email is linked to this trainer. Please add an email in their profile first.
                </div>
              )}

              {success ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>Password Updated & Account Active!</span>
                  </div>

                  <p className="text-xs text-emerald-800 leading-relaxed">
                    The trainer can now log in immediately at <code>/staff/login</code> using this password.
                  </p>

                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-3 py-2">
                    <span className="font-mono text-xs font-bold text-gray-900">{password}</span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"
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

                  <div className="pt-2">
                    <Button type="button" onClick={close} className="w-full">
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs font-medium text-red-800">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700">Temporary Password</label>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#033B36] hover:underline"
                    >
                      <Sparkles className="size-3" />
                      Auto-generate
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                      disabled={saving || !trainerEmail}
                      className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 pr-20 text-xs text-gray-900 shadow-2xs focus:border-[#033B36] focus:outline-none focus:ring-1 focus:ring-[#033B36]"
                    />
                    <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1 text-gray-400">
                      {password && (
                        <button
                          type="button"
                          onClick={handleCopy}
                          title="Copy"
                          className="rounded p-1 hover:text-gray-700"
                        >
                          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="rounded p-1 hover:text-gray-700"
                      >
                        {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700">Confirm Password</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      required
                      disabled={saving || !trainerEmail}
                      className="mt-1.5 h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-xs text-gray-900 shadow-2xs focus:border-[#033B36] focus:outline-none focus:ring-1 focus:ring-[#033B36]"
                    />
                  </div>

                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Setting a temporary password auto-activates and confirms the trainer account. You can copy and provide it to the trainer directly.
                  </p>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={close} disabled={saving}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={saving || !password || !trainerEmail}
                      className="bg-[#033B36] hover:bg-[#022A26]"
                    >
                      {saving ? (
                        <>
                          <LoaderCircle className="size-3.5 animate-spin" /> Setting...
                        </>
                      ) : (
                        'Save & Activate Account'
                      )}
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
