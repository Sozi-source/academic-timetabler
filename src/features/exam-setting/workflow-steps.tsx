import Link from 'next/link';

const STEPS = [
  { number: 1, label: 'Blueprints', href: '/assessment/exam-setting' },
  { number: 2, label: 'Past papers', href: '/assessment/exam-setting/past-papers' },
  { number: 3, label: 'Question bank', href: '/assessment/exam-setting/question-bank' },
  { number: 4, label: 'Generate' },
  { number: 5, label: 'Moderate & export' },
] as const;

export function ExamSettingSteps({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <nav className="grid gap-2 sm:grid-cols-5" aria-label="Exam-setting workflow">
      {STEPS.map((step) => {
        const current = step.number === currentStep;
        const classes = `rounded-lg border px-2.5 py-2 text-xs ${current ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border bg-surface text-text-muted'}`;
        const contents = <><span className="mr-1.5 font-bold">{step.number}.</span>{step.label}</>;

        if ('href' in step && step.number !== currentStep) {
          return <Link key={step.number} href={step.href} className={`${classes} hover:border-primary/30 hover:text-primary`}>{contents}</Link>;
        }

        return (
          <div key={step.number} aria-current={current ? 'step' : undefined} className={classes}>
            {contents}
          </div>
        );
      })}
    </nav>
  );
}
