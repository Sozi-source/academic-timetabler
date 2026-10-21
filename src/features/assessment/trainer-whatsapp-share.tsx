import { MessageCircle } from 'lucide-react';

interface TrainerWhatsAppShareProps {
  trainerName: string;
  phone: string | null;
  unitCode: string;
  unitName: string;
  academicPeriod: string;
  cohorts: string[];
  trainerEntryOpen: boolean;
  compact?: boolean;
}

function toWhatsAppNumber(phone: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `254${digits.slice(1)}`;
  else if (digits.length === 9) digits = `254${digits}`;

  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function TrainerWhatsAppShare({
  trainerName,
  phone,
  unitCode,
  unitName,
  academicPeriod,
  cohorts,
  trainerEntryOpen,
  compact = false,
}: TrainerWhatsAppShareProps) {
  const number = phone ? toWhatsAppNumber(phone) : null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
    ?? 'https://academic-timetabler.vercel.app';
  const message = [
    `Hello ${trainerName},`,
    '',
    `You have been assigned ${unitCode} – ${unitName} for ${academicPeriod}${cohorts.length ? ` (${cohorts.join(', ')})` : ''}.`,
    trainerEntryOpen
      ? 'Please sign in to view your unit and enter marks:'
      : 'Please sign in to view your assigned unit. Mark entry is currently locked:',
    `${baseUrl}/staff/units`,
  ].join('\n');
  const href = number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#128c7e] px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0f766e] active:scale-[0.98] ${compact ? 'w-full sm:w-auto' : ''}`}
      aria-label={`Prepare WhatsApp message for ${trainerName} about ${unitCode}`}
    >
      <MessageCircle className="size-4" />
      Open WhatsApp
    </a>
  ) : (
    <span className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-xs font-medium text-text-muted">
      Add phone number
    </span>
  );
}
