import { ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, FileCheck2, PencilRuler, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';

const steps = [
  { number: 1, title: 'Check your setup', description: 'Confirm the teaching period, classes, units, trainers, rooms and lesson times.', href: '/timetable/readiness', action: 'Check setup', icon: ClipboardCheck },
  { number: 2, title: 'Generate timetable', description: 'Let the system place lessons while avoiding trainer, class and room clashes.', href: '/timetable/generator', action: 'Generate', icon: Sparkles },
  { number: 3, title: 'Review and edit', description: 'Open the timetable, move a lesson when needed, and resolve any warning.', href: '/timetable/editor', action: 'Review timetable', icon: PencilRuler },
  { number: 4, title: 'Publish', description: 'Save the approved version so trainers and students can use it.', href: '/timetable/published', action: 'Publish timetable', icon: FileCheck2 },
];
const setupLinks = [
  ['Teaching period', '/timetable/academic-periods'], ['Lesson days and times', '/timetable/time-slots'], ['Programmes and classes', '/timetable/programmes'], ['Units and trainers', '/timetable/units'], ['Rooms', '/timetable/rooms'], ['Teaching allocations', '/timetable/teaching-allocations'],
] as const;

export default async function DashboardPage() {
  await requireHodAccess();
  return <div className="space-y-8">
    <PageHeader eyebrow="Department timetabler" title="Create your timetable" description="Follow four simple steps. Start by checking that the required information is ready." context={<div className="flex flex-wrap items-center gap-2"><Badge variant="primary">Human Nutrition and Dietetics</Badge><Badge variant="success" dot>Signed in</Badge></div>} />
    <section aria-label="Timetable steps" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {steps.map((step) => { const Icon = step.icon; return <Card key={step.number} className="relative overflow-hidden"><CardHeader><div className="flex items-center justify-between"><span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{step.number}</span><Icon className="size-5 text-primary" aria-hidden="true" /></div><h2 className="mt-5 text-lg font-semibold text-text-primary">{step.title}</h2><p className="mt-2 min-h-16 text-sm leading-6 text-text-secondary">{step.description}</p></CardHeader><CardContent><Link href={step.href} className="inline-flex min-h-11 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90">{step.action}<ArrowRight className="size-4" /></Link></CardContent></Card> })}
    </section>
    <section className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
      <Card><CardHeader><p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">First time setup</p><h2 className="mt-2 text-lg font-semibold text-text-primary">Add only the information the timetable needs</h2><p className="mt-1 text-sm text-text-secondary">You can return to these settings at any time.</p></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{setupLinks.map(([label, href], index) => <Link key={href} href={href} className="flex min-h-12 items-center gap-3 rounded-xl border border-border-soft px-4 text-sm font-medium text-text-secondary transition hover:border-primary hover:bg-primary-soft hover:text-primary"><CheckCircle2 className="size-4 text-primary" />{index + 1}. {label}</Link>)}</CardContent></Card>
      <Card><CardHeader><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><CalendarDays className="size-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Recommended</p><h2 className="mt-1 text-lg font-semibold text-text-primary">Check before generating</h2></div></div></CardHeader><CardContent><p className="text-sm leading-6 text-text-secondary">The setup check tells you exactly what is missing. Fix only the highlighted items, then generate the timetable.</p><Link href="/timetable/readiness" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">Open setup check <ArrowRight className="size-4" /></Link></CardContent></Card>
    </section>
  </div>;
}
