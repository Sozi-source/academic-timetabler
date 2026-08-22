import {
  redirect,
} from 'next/navigation';

export default function LegacyAttendancePage() {
  redirect(
    '/attendance-clinical/class-attendance',
  );
}
