import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getTrainerMarkInvite } from '@/features/assessment/trainer-mark-entry';
import { createAdminClient } from '@/lib/supabase/admin';

const inviteCookieName = 'trainer_mark_invite';
const markValue = z.number().finite().nullable();
const entriesSchema = z.array(z.object({
  assessment_id: z.string().uuid(),
  student_id: z.string().uuid(),
  assignment: markValue,
  presentation: markValue,
  rat: markValue,
  cat: markValue,
  exam: markValue,
  attendance_status: z.enum(['expected', 'absent']).optional(),
})).min(1).max(2000);
const saveSchema = z.object({ cohort_id: z.string().uuid().nullable().optional(), component: z.enum(['all', 'assignment', 'presentation', 'rat', 'cat', 'exam']).default('all'), entries: entriesSchema.min(1).max(2000), submit: z.boolean().default(false) });

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(inviteCookieName)?.value;
  if (!token) return NextResponse.json({ message: 'Open your invitation link to access this markbook.' }, { status: 401 });

  const rawBody = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ message: 'Check the marks and try again.' }, { status: 400 });

  try {
    const invite = await getTrainerMarkInvite(token);
    if (!invite) return NextResponse.json({ message: 'This trainer link has expired or was revoked.' }, { status: 410 });

    const admin = createAdminClient();
    const results: unknown[] = [];

    if (parsed.data.submit && ['assignment', 'presentation', 'rat'].includes(parsed.data.component)) {
      return NextResponse.json({
        message: 'Assignment, Presentation, and RAT marks are saved as drafts and submitted together with final marks at the end of the semester.',
      }, { status: 400 });
    }

    if (invite.scope_unit_id) {
      let scopeQuery = admin.from('assessment_trainer_mark_invites')
        .select('id,assessment_id,cohort_id,token_hash,expires_at,submitted_at,revoked_at')
        .eq('parent_invite_id', invite.id);
      scopeQuery = parsed.data.cohort_id
        ? scopeQuery.eq('cohort_id', parsed.data.cohort_id)
        : scopeQuery.is('cohort_id', null);
      const { data: scopes, error: scopeError } = await scopeQuery;
      if (scopeError || !scopes || scopes.length === 0) {
        return NextResponse.json({ message: 'That cohort is not included in this trainer link.' }, { status: 403 });
      }

      for (const scope of scopes) {
        if (scope.revoked_at || Date.parse(scope.expires_at) <= Date.now()) {
          return NextResponse.json({ message: 'This cohort link has expired or was revoked.' }, { status: 410 });
        }
        if (scope.submitted_at && parsed.data.submit) {
          return NextResponse.json({ message: 'Marks for this cohort have already been submitted.' }, { status: 409 });
        }
      }

      const { data: rawEvents } = await admin
        .from('assessment_events')
        .select('id,trainer_entry_open,status,exam_marks_finalized_at')
        .in('id', scopes.map((s) => s.assessment_id));
      const isLocked = (rawEvents ?? []).some((e) => !e.trainer_entry_open || e.status === 'closed' || e.exam_marks_finalized_at !== null);
      if (isLocked) {
        return NextResponse.json({ message: 'Marks entry is currently closed by the department administration.' }, { status: 403 });
      }

      const { data: scopeRosterRows } = await admin
        .from('assessment_roster')
        .select('assessment_id,student_id,pre_assessment_status')
        .in('assessment_id', scopes.map((s) => s.assessment_id));

      const rosterByAssessment = new Map<string, Map<string, string>>();
      for (const row of scopeRosterRows ?? []) {
        if (!rosterByAssessment.has(row.assessment_id)) {
          rosterByAssessment.set(row.assessment_id, new Map());
        }
        rosterByAssessment.get(row.assessment_id)!.set(row.student_id, row.pre_assessment_status ?? 'expected');
      }

      for (const scope of scopes) {
        const studentStatusMap = rosterByAssessment.get(scope.assessment_id) ?? new Map<string, string>();
        const relevantEntries = parsed.data.entries
          .filter((entry) => studentStatusMap.has(entry.student_id))
          .map(({ assessment_id: _assessmentId, ...entry }) => entry);

        if (relevantEntries.length === 0) continue;

        if (parsed.data.submit) {
          if (parsed.data.component === 'cat') {
            const missingCat = relevantEntries.filter((e) => e.cat === null).length;
            if (missingCat > 0) {
              return NextResponse.json({
                message: `Cannot submit CAT: ${missingCat} student(s) are missing CAT marks.`,
              }, { status: 422 });
            }

            const { data, error } = await admin.rpc('save_assessment_component_with_trainer_invite', {
              target_token_hash: scope.token_hash,
              target_component: 'cat',
              target_entries: relevantEntries,
              submit_component: true,
            });
            if (error) {
              const status = error.code === '42501' ? 403 : error.code === '23514' ? 422 : 409;
              return NextResponse.json({ message: error.message }, { status });
            }
            results.push(data);
          } else {
            // Final marks submission ('all' or 'exam')
            // Prepare final entries: students with null exam marks are confirmed as absent;
            // unsubmitted coursework automatically defaults to 0.
            const finalEntries = relevantEntries.map((e) => {
              const isAbsent = e.attendance_status === 'absent' || e.exam === null;
              return {
                student_id: e.student_id,
                assignment: typeof e.assignment === 'number' ? e.assignment : 0,
                presentation: typeof e.presentation === 'number' ? e.presentation : 0,
                rat: typeof e.rat === 'number' ? e.rat : 0,
                cat: typeof e.cat === 'number' ? e.cat : 0,
                exam: isAbsent ? null : e.exam,
              };
            });

            const absentStudentIds = relevantEntries
              .filter((e) => e.attendance_status === 'absent' || e.exam === null)
              .map((e) => e.student_id);
            const presentStudentIds = relevantEntries
              .filter((e) => e.attendance_status !== 'absent' && e.exam !== null)
              .map((e) => e.student_id);

            if (absentStudentIds.length > 0) {
              await admin
                .from('assessment_roster')
                .update({ pre_assessment_status: 'absent' })
                .eq('assessment_id', scope.assessment_id)
                .in('student_id', absentStudentIds);

              await admin
                .from('assessment_population')
                .update({ attendance_status: 'absent' })
                .eq('assessment_event_id', scope.assessment_id)
                .in('student_id', absentStudentIds);
            }

            if (presentStudentIds.length > 0) {
              await admin
                .from('assessment_roster')
                .update({ pre_assessment_status: 'expected' })
                .eq('assessment_id', scope.assessment_id)
                .in('student_id', presentStudentIds);

              await admin
                .from('assessment_population')
                .update({ attendance_status: 'expected' })
                .eq('assessment_event_id', scope.assessment_id)
                .in('student_id', presentStudentIds);
            }

            // Save all marks and submit
            const { data: savedData, error: saveError } = await admin.rpc('save_assessment_marks_with_trainer_invite', {
              target_token_hash: scope.token_hash,
              target_entries: finalEntries,
              submit_marks: true,
            });
            if (saveError) {
              return NextResponse.json({ message: saveError.message }, { status: 409 });
            }

            // Record submissions for all components
            const allComponents = ['assignment', 'presentation', 'rat', 'cat', 'exam'] as const;
            for (const comp of allComponents) {
              try {
                await admin.from('assessment_mark_component_submissions').upsert({
                  assessment_id: scope.assessment_id,
                  cohort_id: scope.cohort_id ?? null,
                  component_key: comp,
                  source_trainer_invite_id: scope.id,
                }, {
                  onConflict: 'assessment_id,coalesce(cohort_id, \'00000000-0000-0000-0000-000000000000\'::uuid),component_key',
                });
              } catch {
                // ignore
              }
            }

            results.push(savedData ?? { status: 'submitted', savedCount: relevantEntries.length });
          }
        } else {
          // Draft save
          const { data, error } = await admin.rpc('save_assessment_component_with_trainer_invite', {
            target_token_hash: scope.token_hash,
            target_component: parsed.data.component,
            target_entries: relevantEntries,
            submit_component: false,
          });
          if (error) {
            const { data: fallbackData, error: fallbackError } = await admin.rpc('save_assessment_marks_with_trainer_invite', {
              target_token_hash: scope.token_hash,
              target_entries: relevantEntries,
              submit_marks: false,
            });
            if (fallbackError) {
              const status = error.code === '42501' ? 403 : error.code === '23514' ? 422 : 409;
              return NextResponse.json({ message: error.message }, { status });
            }
            results.push(fallbackData ?? { status: 'draft', savedCount: relevantEntries.length });
          } else {
            results.push(data);
          }
        }
      }
    } else {
      if (parsed.data.cohort_id) {
        return NextResponse.json({ message: 'This invitation does not support cohort-specific submission.' }, { status: 400 });
      }
      if (invite.revoked_at || Date.parse(invite.expires_at) <= Date.now()) {
        return NextResponse.json({ message: 'This trainer link has expired or was revoked.' }, { status: 410 });
      }
      if (invite.submitted_at && parsed.data.submit) {
        return NextResponse.json({ message: 'Marks for this markbook have already been submitted.' }, { status: 409 });
      }

      const { data: eventData } = await admin
        .from('assessment_events')
        .select('id,trainer_entry_open,status,exam_marks_finalized_at')
        .eq('id', invite.assessment_id)
        .maybeSingle();
      if (!eventData?.trainer_entry_open || eventData?.status === 'closed' || eventData?.exam_marks_finalized_at !== null) {
        return NextResponse.json({ message: 'Marks entry is currently closed by the department administration.' }, { status: 403 });
      }

      const rawEntries = parsed.data.entries.map(({ assessment_id: _assessmentId, ...entry }) => entry);

      if (parsed.data.submit) {
        if (parsed.data.component === 'cat') {
          const missingCat = rawEntries.filter((e) => e.cat === null).length;
          if (missingCat > 0) {
            return NextResponse.json({
              message: `Cannot submit CAT: ${missingCat} student(s) are missing CAT marks.`,
            }, { status: 422 });
          }

          const { data, error } = await admin.rpc('save_assessment_component_with_trainer_invite', {
            target_token_hash: invite.token_hash,
            target_component: 'cat',
            target_entries: rawEntries,
            submit_component: true,
          });
          if (error) {
            const status = error.code === '42501' ? 403 : error.code === '23514' ? 422 : 409;
            return NextResponse.json({ message: error.message }, { status });
          }
          results.push(data);
        } else {
          // Final marks submission ('all' or 'exam')
          // Prepare final entries: students with null exam marks are confirmed as absent;
          // unsubmitted coursework automatically defaults to 0.
          const finalEntries = rawEntries.map((e) => {
            const isAbsent = e.attendance_status === 'absent' || e.exam === null;
            return {
              student_id: e.student_id,
              assignment: typeof e.assignment === 'number' ? e.assignment : 0,
              presentation: typeof e.presentation === 'number' ? e.presentation : 0,
              rat: typeof e.rat === 'number' ? e.rat : 0,
              cat: typeof e.cat === 'number' ? e.cat : 0,
              exam: isAbsent ? null : e.exam,
            };
          });

          const absentStudentIds = rawEntries
            .filter((e) => e.attendance_status === 'absent' || e.exam === null)
            .map((e) => e.student_id);
          const presentStudentIds = rawEntries
            .filter((e) => e.attendance_status !== 'absent' && e.exam !== null)
            .map((e) => e.student_id);

          if (absentStudentIds.length > 0) {
            await admin
              .from('assessment_roster')
              .update({ pre_assessment_status: 'absent' })
              .eq('assessment_id', invite.assessment_id)
              .in('student_id', absentStudentIds);

            await admin
              .from('assessment_population')
              .update({ attendance_status: 'absent' })
              .eq('assessment_event_id', invite.assessment_id)
              .in('student_id', absentStudentIds);
          }

          if (presentStudentIds.length > 0) {
            await admin
              .from('assessment_roster')
              .update({ pre_assessment_status: 'expected' })
              .eq('assessment_id', invite.assessment_id)
              .in('student_id', presentStudentIds);

            await admin
              .from('assessment_population')
              .update({ attendance_status: 'expected' })
              .eq('assessment_event_id', invite.assessment_id)
              .in('student_id', presentStudentIds);
          }

          const { data: savedData, error: saveError } = await admin.rpc('save_assessment_marks_with_trainer_invite', {
            target_token_hash: invite.token_hash,
            target_entries: finalEntries,
            submit_marks: true,
          });
          if (saveError) {
            return NextResponse.json({ message: saveError.message }, { status: 409 });
          }

          const allComponents = ['assignment', 'presentation', 'rat', 'cat', 'exam'] as const;
          for (const comp of allComponents) {
            try {
              await admin.from('assessment_mark_component_submissions').upsert({
                assessment_id: invite.assessment_id,
                cohort_id: null,
                component_key: comp,
                source_trainer_invite_id: invite.id,
              }, {
                onConflict: 'assessment_id,coalesce(cohort_id, \'00000000-0000-0000-0000-000000000000\'::uuid),component_key',
              });
            } catch {
              // ignore
            }
          }

          results.push(savedData ?? { status: 'submitted', savedCount: rawEntries.length });
        }
      } else {
        // Draft save
        const { data, error } = await admin.rpc('save_assessment_component_with_trainer_invite', {
          target_token_hash: invite.token_hash,
          target_component: parsed.data.component,
          target_entries: rawEntries,
          submit_component: false,
        });
        if (error) {
          const { data: fallbackData, error: fallbackError } = await admin.rpc('save_assessment_marks_with_trainer_invite', {
            target_token_hash: invite.token_hash,
            target_entries: rawEntries,
            submit_marks: false,
          });
          if (fallbackError) {
            const status = error.code === '42501' ? 403 : error.code === '23514' ? 422 : 409;
            return NextResponse.json({ message: error.message }, { status });
          }
          results.push(fallbackData ?? { status: 'draft', savedCount: rawEntries.length });
        } else {
          results.push(data);
        }
      }
    }
    const savedCount = results.reduce<number>((total, result) => {
      if (typeof result !== 'object' || result === null || !('savedCount' in result)) return total;
      const count = result.savedCount;
      return total + (typeof count === 'number' ? count : 0);
    }, 0);
    return NextResponse.json({ success: true, result: { scopes: results, savedCount } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Unable to save trainer marks.' }, { status: 500 });
  }
}
