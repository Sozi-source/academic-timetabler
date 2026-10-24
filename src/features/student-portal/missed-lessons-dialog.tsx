'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  ShieldAlert,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { StudentPortalAttendanceSession } from '@/features/attendance-analytics/types';
import { formatPortalClock } from './domain';

interface MissedLessonsDialogProps {
  missedLessons: StudentPortalAttendanceSession[];
  triggerVariant?: 'button' | 'compact' | 'badge';
  className?: string;
}

export function MissedLessonsDialog({
  missedLessons,
  triggerVariant = 'button',
  className,
}: MissedLessonsDialogProps) {
  const [open, setOpen] = useState(false);
  const count = missedLessons.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerVariant === 'compact' ? (
          <button
            type="button"
            aria-label={`View ${count} missed lessons`}
            className={
              className ||
              'inline-flex items-center gap-1.5 rounded-lg border border-rose-200/90 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 transition hover:bg-rose-100 hover:border-rose-300 active:scale-95 shadow-2xs'
            }
          >
            <AlertTriangle className="size-3.5 text-rose-600 shrink-0" aria-hidden="true" />
            <span>Missed Lessons</span>
            <span className="flex size-4.5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-2xs">
              {count}
            </span>
          </button>
        ) : triggerVariant === 'badge' ? (
          <button
            type="button"
            aria-label={`View ${count} missed lessons`}
            className={
              className ||
              'inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 transition hover:bg-rose-100 active:scale-95'
            }
          >
            <span className="size-1.5 rounded-full bg-rose-600 animate-pulse" />
            <span>{count} Missed</span>
          </button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`View ${count} missed lessons`}
            className={
              className ||
              'h-8 gap-2 rounded-xl border-rose-200/90 bg-rose-50/80 px-3 text-xs font-bold text-rose-800 transition hover:bg-rose-100 hover:border-rose-300 hover:text-rose-900 active:scale-95 shadow-2xs'
            }
          >
            <AlertTriangle className="size-3.5 text-rose-600 shrink-0" aria-hidden="true" />
            <span>View Missed Lessons</span>
            <span className="flex size-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-2xs">
              {count}
            </span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="bg-rose-50/50">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
              <AlertTriangle className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <DialogTitle className="text-base text-rose-950 font-bold">
                Missed Lessons ({count})
              </DialogTitle>
              <DialogDescription className="text-xs text-rose-800/90">
                Class sessions recorded as absent during this semester.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4 max-h-[60vh] overflow-y-auto py-4">
          {count === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm font-bold text-text-primary">No Missed Lessons</p>
              <p className="mt-1 text-xs text-text-muted">
                Your class attendance is in good standing. Keep up the regular attendance!
              </p>
            </div>
          ) : (
            <>
              {/* College Policy Notice */}
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200/70 bg-rose-50/70 p-3 text-xs text-rose-900">
                <ShieldAlert className="size-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
                <p className="text-[11.5px] leading-relaxed text-rose-900/90">
                  <span className="font-bold">TVET Attendance Requirement:</span> Students are required to maintain a minimum of 75% attendance in each registered unit to sit for Continuous Assessment Tests (CATs) and final examinations.
                </p>
              </div>

              {/* Missed Lessons List */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Absence Log
                </p>

                <div className="divide-y divide-border rounded-xl border border-border bg-surface overflow-hidden shadow-2xs">
                  {missedLessons.map((lesson) => (
                    <div
                      key={lesson.classSessionId}
                      className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text-primary">
                          {lesson.unitName}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-text-muted">
                          {lesson.cohortName}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end text-[11px] font-mono text-text-secondary">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3 text-text-muted" aria-hidden="true" />
                          {lesson.sessionDate}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-text-muted" aria-hidden="true" />
                          {formatPortalClock(lesson.startsAt)}–{formatPortalClock(lesson.endsAt)}
                        </span>
                        <Badge variant="danger" className="text-[10px] py-0.5 px-2 font-bold">
                          Absent
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dispute & Guidance Box */}
              <div className="flex items-start gap-2 rounded-xl border border-border bg-surface-subtle p-3 text-[11px] text-text-muted">
                <Info className="size-3.5 shrink-0 text-text-secondary mt-0.5" aria-hidden="true" />
                <p className="leading-relaxed">
                  If an absence was recorded in error or due to authorized medical/compassionate leave, please present relevant documentation to your unit trainer or Head of Department for review and reconciliation.
                </p>
              </div>
            </>
          )}
        </DialogBody>

        <DialogFooter className="border-t border-border bg-surface px-6 py-3">
          <DialogClose asChild>
            <Button variant="secondary" size="sm" className="font-semibold text-xs">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
