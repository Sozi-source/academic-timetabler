import { ExamControlSkeleton } from '@/features/assessment/exam-control-skeleton';

export default function AssessmentMarkbookLoading() {
  return <ExamControlSkeleton cards={4} rows={12} showToolbar />;
}
