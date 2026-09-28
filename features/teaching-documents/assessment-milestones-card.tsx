'use client';

import { useState } from 'react';
import { CalendarCheck, Edit3, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import type { AssessmentMilestones } from './assessment-milestones';
import { saveAssessmentMilestonesAction } from './assessment-milestones-actions';

interface AssessmentMilestonesCardProps {
  milestones: AssessmentMilestones;
}

export function AssessmentMilestonesCard({
  milestones,
}: AssessmentMilestonesCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      await saveAssessmentMilestonesAction(formData);
      setIsOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save milestones');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="p-3.5 bg-surface border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-primary/10 p-1 text-primary">
            <CalendarCheck className="size-3.5" />
          </span>
          <h3 className="text-xs font-bold text-text-primary">
            Assessment Milestones
          </h3>
        </div>

        <Drawer open={isOpen} onOpenChange={setIsOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Edit3 className="size-3" />}
            >
              Configure
            </Button>
          </DrawerTrigger>

          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Configure Assessment Milestones</DrawerTitle>
            </DrawerHeader>

            <DrawerBody>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* CAT Week */}
                <div className="rounded-xl border border-border bg-surface-subtle/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-primary">
                      Continuous Assessment Test (CAT)
                    </label>
                    <span className="text-[11px] font-semibold text-primary">30% Coursework</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="text-[10px] font-medium text-text-muted">Week #</label>
                      <select
                        name="catWeek"
                        defaultValue={milestones.catWeek}
                        className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-text-primary"
                      >
                        {Array.from({ length: 14 }, (_, i) => i + 1).map((w) => (
                          <option key={w} value={w}>
                            Week {w}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-medium text-text-muted">Description</label>
                      <input
                        name="catRemarks"
                        defaultValue={milestones.catRemarks}
                        className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-text-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-text-muted">Scheduled Date / Period (College-wide)</label>
                    <input
                      name="catDate"
                      defaultValue={milestones.catDate}
                      placeholder="e.g. 30th June – 4th July 2026"
                      className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted/60"
                    />
                  </div>
                </div>

                {/* Exam Week */}
                <div className="rounded-xl border border-border bg-surface-subtle/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-primary">
                      End of Term Examination
                    </label>
                    <span className="text-[11px] font-semibold text-primary">70% Summative</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="text-[10px] font-medium text-text-muted">Week #</label>
                      <select
                        name="examWeek"
                        defaultValue={milestones.examWeek}
                        className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-text-primary"
                      >
                        {Array.from({ length: 14 }, (_, i) => i + 1).map((w) => (
                          <option key={w} value={w}>
                            Week {w}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-medium text-text-muted">Description</label>
                      <input
                        name="examRemarks"
                        defaultValue={milestones.examRemarks}
                        className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-text-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-text-muted">Scheduled Date / Period (College-wide)</label>
                    <input
                      name="examDate"
                      defaultValue={milestones.examDate}
                      placeholder="e.g. 10th – 14th August 2026"
                      className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted/60"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending}
                    leadingIcon={<Save className="size-3.5" />}
                  >
                    {isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </form>
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </div>

      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2.5 border-t border-border">
        <div className="flex items-center justify-between rounded-lg bg-surface-subtle/60 px-3 py-2">
          <div>
            <div className="text-[10px] font-bold uppercase text-text-muted">Continuous Assessment</div>
            <div className="text-xs font-semibold text-text-primary">CAT · 30% Weighting</div>
            {milestones.catDate && (
              <div className="text-[10px] font-medium text-primary mt-0.5">📅 {milestones.catDate}</div>
            )}
          </div>
          <Badge variant="neutral">Week {milestones.catWeek}</Badge>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-surface-subtle/60 px-3 py-2">
          <div>
            <div className="text-[10px] font-bold uppercase text-text-muted">Final Examination</div>
            <div className="text-xs font-semibold text-text-primary">End-Term · 70% Weighting</div>
            {milestones.examDate && (
              <div className="text-[10px] font-medium text-primary mt-0.5">📅 {milestones.examDate}</div>
            )}
          </div>
          <Badge variant="neutral">Week {milestones.examWeek}</Badge>
        </div>
      </div>
    </Card>
  );
}
