import { ExamControlSkeleton } from '@/features/assessment/exam-control-skeleton';

export default function MissingMarksLoading() {
  return <ExamControlSkeleton cards={4} rows={10} showToolbar />;
}
