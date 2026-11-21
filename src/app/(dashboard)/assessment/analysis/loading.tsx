import { ExamControlSkeleton } from '@/features/assessment/exam-control-skeleton';

export default function AssessmentAnalysisLoading() {
  return <ExamControlSkeleton cards={4} rows={8} showToolbar={false} />;
}
