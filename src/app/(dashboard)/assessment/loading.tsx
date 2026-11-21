import { ExamControlSkeleton } from '@/features/assessment/exam-control-skeleton';

export default function AssessmentLoading() {
  return <ExamControlSkeleton cards={3} rows={8} showToolbar />;
}
