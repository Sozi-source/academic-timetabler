import {
  redirect,
} from 'next/navigation';

interface PageProps {
  params:
    Promise<{
      sessionId:
        string;
    }>;
}

export default async function LegacyAttendanceSessionPage({
  params,
}: PageProps) {
  const {
    sessionId,
  } =
    await params;

  redirect(
    `/attendance-clinical/class-attendance/${sessionId}`,
  );
}
