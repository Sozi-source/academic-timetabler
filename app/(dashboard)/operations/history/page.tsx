import {
  redirect,
} from 'next/navigation';

export default function LegacyOperationsHistoryPage() {
  redirect(
    '/operations/audit',
  );
}
