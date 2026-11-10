'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import type { MissingStudentInfo } from './pending-submissions';

interface CopyMissingStudentsButtonProps {
  unitCode: string;
  unitName: string;
  missingStudents: MissingStudentInfo[];
}

export function CopyMissingStudentsButton({
  unitCode,
  unitName,
  missingStudents,
}: CopyMissingStudentsButtonProps) {
  const [copied, setCopied] = useState(false);

  if (missingStudents.length === 0) return null;

  async function handleCopy() {
    const lines = [
      `Missing CAT Marks: ${unitCode} - ${unitName}`,
      `Total Pending: ${missingStudents.length} candidate(s)`,
      '',
      ...missingStudents.map(
        (s, idx) => `${idx + 1}. ${s.admissionNumber} - ${s.fullName}`,
      ),
      '',
      'Please enter marks for these students to complete CAT submission.',
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for restricted clipboard contexts
      const textarea = document.createElement('textarea');
      textarea.value = lines.join('\n');
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 shadow-2xs transition hover:bg-amber-100/70"
      title="Copy list of missing students to clipboard for communication with trainer"
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
          <span className="text-emerald-700 font-bold">Copied List!</span>
        </>
      ) : (
        <>
          <Copy className="size-3.5 text-amber-700" aria-hidden="true" />
          <span>Copy Missing Students ({missingStudents.length})</span>
        </>
      )}
    </button>
  );
}
